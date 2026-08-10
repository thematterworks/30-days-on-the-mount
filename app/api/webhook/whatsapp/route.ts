import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  parseWhatsAppWebhookPayload,
  sendFreeformTextMessage,
  sendTemplateMessage,
} from "@/lib/whatsapp";
import { GATEKEEPER_TRIGGER, generateGatekeeperReply, generateReflectionReply } from "@/lib/ai";
import { getAiPersonaSystemPrompt, isAiAutoReplyEnabled } from "@/lib/system-config";
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
  // 1. Static ice-breaker intercepts — exact match, before any AI call.
  const staticReply = ICE_BREAKER_RESPONSES[text];
  if (staticReply) {
    await sendAndLog(supabase, user.phone_number, "freeform", staticReply);
    return;
  }

  if (text === ACTIVATION_TRIGGER_TEXT) {
    if (user.status === "pending") {
      await activateUser(supabase, user.phone_number);
    } else {
      // Already onboarded (or opted out/completed) — don't clobber their
      // progress by resending Day 0; just orient them.
      await sendAndLog(
        supabase,
        user.phone_number,
        "freeform",
        `You've already begun this journey — you're currently on Day ${user.current_day}.`,
      );
    }
    return;
  }

  const autoReplyEnabled = await isAiAutoReplyEnabled();
  if (!autoReplyEnabled || user.ai_paused) {
    return;
  }

  // 2. Waiting-room participants: freeform text goes through the Gatekeeper,
  // whose only job is to decide if they're ready to begin.
  if (user.status === "pending") {
    let gatekeeperReply: string;
    try {
      gatekeeperReply = await generateGatekeeperReply(text);
    } catch (error) {
      await logAiFailure(supabase, user.phone_number, "Gatekeeper reply failed", error);
      return;
    }

    if (gatekeeperReply.trim() === GATEKEEPER_TRIGGER) {
      // Intercepted server-side — the trigger string itself is never sent
      // to WhatsApp. Only the Day 0 template goes out.
      await activateUser(supabase, user.phone_number);
      return;
    }

    await sendAndLog(supabase, user.phone_number, "ai_generated", gatekeeperReply);
    return;
  }

  // 3. Already-active participants: existing day-aware reflection AI.
  if (user.status === "active") {
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

/** Marks a pending participant active on Day 0 and sends the Day 0 welcome template. */
async function activateUser(supabase: Supabase, phoneNumber: string): Promise<void> {
  await supabase.from("users").update({ status: "active", current_day: 0 }).eq("phone_number", phoneNumber);

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
