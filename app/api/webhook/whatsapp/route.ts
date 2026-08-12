import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  parseWhatsAppWebhookPayload,
  sendFreeformTextMessage,
  sendTemplateMessage,
} from "@/lib/whatsapp";
import {
  GATEKEEPER_TRIGGER,
  detectYesNo,
  extractPreferredHour,
  generateEveningReflectionReply,
  generateGatekeeperReply,
  generateReflectionReply,
} from "@/lib/ai";
import {
  getAiPersonaSystemPrompt,
  getEveningCheckinTemplateName,
  getEveningReflectionSystemPrompt,
  isAiAutoReplyEnabled,
} from "@/lib/system-config";
import type { MessageStatus, MessageType, UserRow } from "@/lib/supabase/types";

type Supabase = ReturnType<typeof getSupabaseAdmin>;

/** Meta webhook handshake verification. */
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, statuses } = parseWhatsAppWebhookPayload(payload);
  const supabase = getSupabaseAdmin();

  await Promise.all(statuses.map((status) => applyStatusUpdate(status)));

  for (const message of messages) {
    try {
      await handleInboundMessage(message);
    } catch (error) {
      console.error("Failed to process inbound WhatsApp message", error);
    }
  }

  return NextResponse.json({ ok: true });

  async function applyStatusUpdate(status: (typeof statuses)[number]) {
    await supabase
      .from("message_logs")
      .update({ status: status.status })
      .eq("whatsapp_message_id", status.whatsappMessageId);
  }
}

// ============================================================================
// Switchboard: static ice-breaker intercepts, checked as an exact match
// before any message reaches Claude. These mirror the preset ice-breaker
// buttons configured on the WhatsApp business profile.
// ============================================================================

const ICE_BREAKER_RESPONSES: Record<string, string> = {
  "What is this?":
    "This is a 30-day journey through the Sermon on the Mount. It is not an information class or a performance program designed to make you a 'better person.' Instead, it is a daily invitation to strip away the performative armor of the ego and step into the radical, unscripted life of the Kingdom. Each day, you will receive a single, focused practice designed to disrupt your survival mechanisms and anchor you deeply in the presence of the Father. Whenever you are ready, simply tell me you'd like to begin.",
  "How does it work?":
    "It works through a daily rhythm of reflection and practice. Each morning, you will receive a short, focused message containing a daily invitation, a scripture from the Sermon, a short synopsis, and a concrete practice for your day. There are no streaks to keep and no tests to pass. Read it, sit with it, and live it. If you have questions or want to process what is coming up for you, you can text back here at any time, and we will walk through it together. Whenever you are ready, simply tell me you'd like to begin.",
  "Intention & Outcomes":
    "The intention of this challenge is complete transformation—what the ancient writers called _kenosis_, or the emptying of the ego. We spend most of our lives managing our image, defending our rights, and surviving through the scarcity of the _bios_. The outcome of these 30 days is to break the stronghold of self-preservation and anchor your life entirely in the infinite, zero-agenda love of the Father. You will be challenged, stretched, and invited into a profound, unshakeable freedom. Whenever you are ready, simply tell me you'd like to begin.",
};

/** Exact ice-breaker text that activates the challenge immediately, no Gatekeeper needed. */
const ACTIVATION_TRIGGER_TEXT = "Let's begin the Challenge.";

async function handleInboundMessage(message: {
  from: string;
  text: string;
  whatsappMessageId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { from, whatsappMessageId } = message;
  const text = message.text.trim();

  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("phone_number", from)
    .maybeSingle();

  let user: UserRow | null = existingUser;

  if (!user) {
    // New contact: land them in the waiting room. The challenge no longer
    // starts automatically — status stays 'pending' (current_day: -1) until
    // the switchboard below explicitly activates them.
    const { data: created } = await supabase
      .from("users")
      .insert({
        phone_number: from,
        status: "pending",
        current_day: -1,
        last_interaction_at: new Date().toISOString(),
      })
      .select()
      .single();
    user = created;
  } else {
    await supabase
      .from("users")
      .update({ last_interaction_at: new Date().toISOString() })
      .eq("phone_number", from);
  }

  await logMessage(supabase, {
    phoneNumber: from,
    direction: "inbound",
    messageType: "freeform",
    body: text,
    whatsappMessageId,
    status: "delivered",
  });

  if (!user) {
    console.error("Failed to create or load user record for", from);
    return;
  }

  await runSwitchboard(supabase, user, text);
}

async function runSwitchboard(supabase: Supabase, user: UserRow, text: string) {
  // 1. Static ice-breaker intercepts — exact match, before any AI call,
  // available at any point in the conversation (including mid-onboarding).
  const staticReply = ICE_BREAKER_RESPONSES[text];
  if (staticReply) {
    await sendAndLog(supabase, user.phone_number, "freeform", staticReply);
    return;
  }

  if (text === ACTIVATION_TRIGGER_TEXT && user.status !== "pending") {
    // Already onboarded (or opted out/completed) — don't clobber their
    // progress by resending Day 0; just orient them. (A pending user hitting
    // this exact text is handled inside the onboarding state machine below,
    // since it's only a readiness signal when onboarding hasn't started.)
    await sendAndLog(
      supabase,
      user.phone_number,
      "freeform",
      `You've already begun this journey — you're currently on Day ${user.current_day}.`,
    );
    return;
  }

  const autoReplyEnabled = await isAiAutoReplyEnabled();
  if (!autoReplyEnabled || user.ai_paused) {
    return;
  }

  // 2. Waiting-room participants: conversational onboarding state machine.
  if (user.status === "pending") {
    await handleOnboardingStep(supabase, user, text);
    return;
  }

  // 3. Already-active participants.
  if (user.status === "active") {
    // Evening Check-In: if the most recent template we sent this
    // participant was the evening check-in (not the morning curriculum
    // template), treat this reply as end-of-day reflection and route it
    // through the pastoral-care persona instead of the daily reflection AI.
    // This self-resets every morning once daily-push sends the next day's
    // template, with no extra schema needed.
    if (await wasLastTemplateEveningCheckin(supabase, user.phone_number)) {
      const eveningSystemPrompt = await getEveningReflectionSystemPrompt();

      let eveningReply: string;
      try {
        eveningReply = await generateEveningReflectionReply(eveningSystemPrompt, text);
      } catch (error) {
        await logAiFailure(supabase, user.phone_number, "Evening reflection reply failed", error);
        return;
      }

      await sendAndLog(supabase, user.phone_number, "ai_generated", eveningReply);
      return;
    }

    // Otherwise: existing day-aware reflection AI.
    const { data: curriculumDay } = await supabase
      .from("curriculum_days")
      .select("*")
      .eq("day_number", user.current_day)
      .maybeSingle();

    const personaSystemPrompt = await getAiPersonaSystemPrompt();

    let reply: string;
    try {
      reply = await generateReflectionReply({
        personaSystemPrompt,
        dayNumber: user.current_day,
        dayTitle: curriculumDay?.title ?? `Day ${user.current_day}`,
        dayAiGuidancePrompt: curriculumDay?.ai_guidance_prompt ?? "",
        userMessage: text,
      });
    } catch (error) {
      await logAiFailure(supabase, user.phone_number, "AI reflection reply failed", error);
      return;
    }

    await sendAndLog(supabase, user.phone_number, "ai_generated", reply);
    return;
  }

  // 4. paused / completed / opted_out: the inbound message is already
  // logged above, but none of these statuses get an automated reply.
}

// ============================================================================
// Conversational onboarding state machine, for status = 'pending'.
// not_started -> awaiting_name -> awaiting_time -> awaiting_email_pref
//   -> (awaiting_email_address ->) completed (status flips to 'active')
// ============================================================================

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleOnboardingStep(supabase: Supabase, user: UserRow, text: string): Promise<void> {
  switch (user.onboarding_step) {
    case "not_started": {
      // The exact ice-breaker button is a deterministic readiness signal —
      // no need to spend an AI call confirming what we already know.
      if (text === ACTIVATION_TRIGGER_TEXT) {
        await beginOnboarding(supabase, user.phone_number);
        return;
      }

      let gatekeeperReply: string;
      try {
        gatekeeperReply = await generateGatekeeperReply(text);
      } catch (error) {
        await logAiFailure(supabase, user.phone_number, "Gatekeeper reply failed", error);
        return;
      }

      if (gatekeeperReply.trim() === GATEKEEPER_TRIGGER) {
        // Intercepted server-side — the trigger string itself is never sent
        // to WhatsApp. Only the name prompt goes out.
        await beginOnboarding(supabase, user.phone_number);
        return;
      }

      await sendAndLog(supabase, user.phone_number, "ai_generated", gatekeeperReply);
      return;
    }

    case "awaiting_name": {
      const firstName = text.slice(0, 50).trim() || "friend";
      await supabase
        .from("users")
        .update({ first_name: firstName, onboarding_step: "awaiting_time" })
        .eq("phone_number", user.phone_number);
      await sendAndLog(
        supabase,
        user.phone_number,
        "freeform",
        `It's good to meet you, ${firstName}. What time of day would you like to receive your daily invitation — morning, afternoon, evening, or a specific time?`,
      );
      return;
    }

    case "awaiting_time": {
      let hour: number | null;
      try {
        hour = await extractPreferredHour(text);
      } catch (error) {
        await logAiFailure(supabase, user.phone_number, "Preferred-hour extraction failed", error);
        return;
      }

      if (hour === null) {
        await sendAndLog(
          supabase,
          user.phone_number,
          "freeform",
          'I didn\'t quite catch a time there — could you tell me roughly when, like "7am" or "evening"?',
        );
        return;
      }

      await supabase
        .from("users")
        .update({ preferred_delivery_hour: hour, onboarding_step: "awaiting_email_pref" })
        .eq("phone_number", user.phone_number);
      await sendAndLog(
        supabase,
        user.phone_number,
        "freeform",
        "Got it. Would you also like to receive your daily invitation by email, alongside WhatsApp?",
      );
      return;
    }

    case "awaiting_email_pref": {
      let wantsEmail: boolean | null;
      try {
        wantsEmail = await detectYesNo(text);
      } catch (error) {
        await logAiFailure(supabase, user.phone_number, "Email-preference detection failed", error);
        return;
      }

      if (wantsEmail === null) {
        await sendAndLog(
          supabase,
          user.phone_number,
          "freeform",
          "Just a simple yes or no — would you like email too?",
        );
        return;
      }

      if (!wantsEmail) {
        await supabase.from("users").update({ wants_email: false }).eq("phone_number", user.phone_number);
        await completeOnboardingAndActivate(supabase, user.phone_number);
        return;
      }

      await supabase
        .from("users")
        .update({ wants_email: true, onboarding_step: "awaiting_email_address" })
        .eq("phone_number", user.phone_number);
      await sendAndLog(supabase, user.phone_number, "freeform", "Wonderful — what email address should I use?");
      return;
    }

    case "awaiting_email_address": {
      const email = text.trim();
      if (!EMAIL_PATTERN.test(email)) {
        await sendAndLog(
          supabase,
          user.phone_number,
          "freeform",
          "That doesn't look like a valid email address — could you send it again?",
        );
        return;
      }

      await supabase.from("users").update({ email_address: email }).eq("phone_number", user.phone_number);
      await completeOnboardingAndActivate(supabase, user.phone_number);
      return;
    }

    case "completed":
      // A 'pending' user shouldn't normally have onboarding_step
      // 'completed' — but don't leave them stuck if it happens; treat it
      // like a fresh start.
      await handleOnboardingStep(supabase, { ...user, onboarding_step: "not_started" }, text);
      return;
  }
}

/** First step of onboarding: ask for the participant's name. */
async function beginOnboarding(supabase: Supabase, phoneNumber: string): Promise<void> {
  await supabase.from("users").update({ onboarding_step: "awaiting_name" }).eq("phone_number", phoneNumber);
  await sendAndLog(
    supabase,
    phoneNumber,
    "freeform",
    "I'm so glad you're here. What name would you like me to call you?",
  );
}

/** Marks onboarding complete, activates the participant on Day 0, and sends the Day 0 welcome template. */
async function completeOnboardingAndActivate(supabase: Supabase, phoneNumber: string): Promise<void> {
  await supabase
    .from("users")
    .update({ status: "active", current_day: 0, onboarding_step: "completed" })
    .eq("phone_number", phoneNumber);

  const { data: welcomeDay } = await supabase
    .from("curriculum_days")
    .select("template_name")
    .eq("day_number", 0)
    .maybeSingle();

  const templateName = welcomeDay?.template_name ?? "day_00_welcome";
  const result = await sendTemplateMessage(phoneNumber, templateName);

  await logMessage(supabase, {
    phoneNumber,
    direction: "outbound",
    messageType: "template",
    body: `[template:${templateName}]`,
    whatsappMessageId: result.messageId,
    status: result.ok ? "sent" : "failed",
  });
}

/**
 * True if the most recent outbound template sent to this participant was
 * the evening check-in template (rather than a morning curriculum
 * template). Templates are logged as `[template:<name>]` in message_body
 * by activateUser, the daily-push cron, and the evening-checkin cron alike.
 */
async function wasLastTemplateEveningCheckin(supabase: Supabase, phoneNumber: string): Promise<boolean> {
  const eveningTemplateName = await getEveningCheckinTemplateName();

  const { data } = await supabase
    .from("message_logs")
    .select("message_body")
    .eq("phone_number", phoneNumber)
    .eq("direction", "outbound")
    .eq("message_type", "template")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.message_body === `[template:${eveningTemplateName}]`;
}

/** Sends a freeform WhatsApp text reply and logs the outcome. */
async function sendAndLog(supabase: Supabase, phoneNumber: string, messageType: MessageType, body: string) {
  const result = await sendFreeformTextMessage(phoneNumber, body);
  await logMessage(supabase, {
    phoneNumber,
    direction: "outbound",
    messageType,
    body,
    whatsappMessageId: result.messageId,
    status: result.ok ? "sent" : "failed",
  });
}

/**
 * Logs an AI engine failure as a visible message_logs row (status: failed)
 * instead of silently dropping the reply — this is what makes AI
 * misconfiguration (e.g. a bad AI_API_KEY) show up in the Live Conversation
 * Inbox rather than only in Vercel's function logs.
 */
async function logAiFailure(supabase: Supabase, phoneNumber: string, context: string, error: unknown) {
  const messageText = error instanceof Error ? error.message : "Unknown AI engine error";
  console.error(context, error);
  await logMessage(supabase, {
    phoneNumber,
    direction: "outbound",
    messageType: "ai_generated",
    body: `[AI reply failed: ${messageText}]`,
    whatsappMessageId: null,
    status: "failed",
  });
}

async function logMessage(
  supabase: Supabase,
  params: {
    phoneNumber: string;
    direction: "inbound" | "outbound";
    messageType: MessageType;
    body: string;
    whatsappMessageId: string | null;
    status: MessageStatus;
  },
) {
  await supabase.from("message_logs").insert({
    phone_number: params.phoneNumber,
    direction: params.direction,
    message_type: params.messageType,
    message_body: params.body,
    whatsapp_message_id: params.whatsappMessageId,
    status: params.status,
  });
}
