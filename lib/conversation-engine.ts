import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendFreeformToChannel, sendPushToChannel } from "@/lib/messaging";
import { DEFAULT_TIMEZONE, getLocalDate } from "@/lib/timezone";
import {
  GATEKEEPER_TRIGGER,
  detectYesNo,
  extractPreferredHour,
  generateEveningReflectionReply,
  generateGatekeeperReply,
  generateReflectionReply,
} from "@/lib/ai";
import { getAiPersonaSystemPrompt, getEveningReflectionSystemPrompt, isAiAutoReplyEnabled } from "@/lib/system-config";
import type { MessageChannel, MessageStatus, MessageType, UserRow } from "@/lib/supabase/types";

type Supabase = ReturnType<typeof getSupabaseAdmin>;

// ============================================================================
// Switchboard: static ice-breaker intercepts, checked as an exact match
// before any message reaches Claude. These mirror the preset ice-breaker
// buttons configured on the WhatsApp business profile. Channel-agnostic —
// the same copy applies whether the participant reached us over WhatsApp or
// SMS.
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

/**
 * Matches ACTIVATION_TRIGGER_TEXT exactly (the WhatsApp ice-breaker button
 * text), or the standard SMS opt-in keyword "START" (case-insensitive) —
 * published on the public landing page as the text-to-opt-in call to
 * action, so it must actually work.
 */
function isActivationTrigger(text: string): boolean {
  return text === ACTIVATION_TRIGGER_TEXT;
}

/**
 * Primary SMS opt-in keywords (case-insensitive, trimmed). Texting either
 * one registers the participant immediately on Day 0 — active, premium — and
 * fires the Day 0 welcome, with no conversational onboarding in between. This
 * is the frictionless A2P opt-in the public CTA points at.
 */
const OPT_IN_KEYWORDS = new Set(["MOUNTAIN", "START"]);

function isOptInKeyword(text: string): boolean {
  return OPT_IN_KEYWORDS.has(text.trim().toUpperCase());
}

/**
 * Compliance opt-out keywords (case-insensitive, exact match). Checked
 * before anything else in handleInboundMessage — including the Anthropic
 * AI engine entirely — regardless of the participant's current status or
 * onboarding step. This must always work.
 */
const OPT_OUT_KEYWORDS = new Set(["STOP", "UNSUBSCRIBE", "CANCEL"]);

function isOptOutKeyword(text: string): boolean {
  return OPT_OUT_KEYWORDS.has(text.trim().toUpperCase());
}

/** A2P 10DLC compliance keyword — checked with the same priority as opt-out. */
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

function isHelpKeyword(text: string): boolean {
  return HELP_KEYWORDS.has(text.trim().toUpperCase());
}

/**
 * Single entry point for both the WhatsApp and Twilio SMS webhooks. Each
 * webhook route only handles provider-specific concerns (payload parsing,
 * signature/handshake verification, delivery-status callbacks) and then
 * calls this with a normalized inbound message.
 */
export async function handleInboundMessage(params: {
  channel: MessageChannel;
  from: string;
  text: string;
  providerMessageId: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { channel, from, providerMessageId } = params;
  const text = params.text.trim();

  const { data: existingUser } = await supabase.from("users").select("*").eq("phone_number", from).maybeSingle();

  let user: UserRow | null = existingUser;

  if (!user) {
    // New contact: land them in the waiting room, and lock in the channel
    // they first reached us on. The challenge no longer starts
    // automatically — status stays 'pending' (current_day: -1) until the
    // switchboard below explicitly activates them.
    const { data: created } = await supabase
      .from("users")
      .insert({
        phone_number: from,
        status: "pending",
        current_day: -1,
        last_interaction_at: new Date().toISOString(),
        channel,
        access_tier: "premium", // universal premium — everyone gets /journey
      })
      .select()
      .single();
    user = created;
  } else {
    await supabase.from("users").update({ last_interaction_at: new Date().toISOString() }).eq("phone_number", from);
  }

  // Logged with the transport this specific message actually arrived on
  // (channel), not necessarily user.channel — a participant's outbound
  // channel is locked at creation, but nothing stops them from texting in
  // from the other transport occasionally.
  await logMessage(supabase, {
    phoneNumber: from,
    direction: "inbound",
    messageType: "freeform",
    body: text,
    providerMessageId,
    status: "delivered",
    channel,
  });

  if (!user) {
    console.error("Failed to create or load user record for", from);
    return;
  }

  // Compliance opt-out — checked first, ahead of ice-breakers, onboarding,
  // and every AI path. Works regardless of current status (including an
  // already-'pending' or already-'opted_out' participant) so it can never
  // be blocked by the global AI toggle or a per-user ai_paused flag.
  if (isOptOutKeyword(text)) {
    await handleOptOut(supabase, user);
    return;
  }

  // Same priority and reasoning as opt-out: A2P 10DLC compliance requires
  // HELP to always work, regardless of AI toggle, pause state, or
  // onboarding step — so it's checked here, not inside the switchboard.
  if (isHelpKeyword(text)) {
    await sendAndLog(
      supabase,
      user,
      "freeform",
      "30 Days on the Mount: a daily practice through the Sermon on the Mount. For support, email 30daysonthemount@gmail.com. Msg&data rates may apply. Reply STOP to unsubscribe at any time.",
    );
    return;
  }

  // Primary opt-in: MOUNTAIN / START activate immediately on Day 0 (active,
  // premium) and fire the Day 0 welcome — no conversational onboarding.
  // Checked before the switchboard so it works from any status.
  if (isOptInKeyword(text)) {
    await handleOptIn(supabase, user);
    return;
  }

  await runSwitchboard(supabase, user, text);
}

/**
 * Frictionless opt-in: a participant who isn't already active is registered
 * on Day 0 (active + premium) and immediately sent the Day 0 welcome. An
 * already-active participant is simply re-oriented, so re-texting the keyword
 * never resets their progress.
 */
async function handleOptIn(supabase: Supabase, user: UserRow): Promise<void> {
  if (user.status === "active") {
    await sendAndLog(
      supabase,
      user,
      "freeform",
      `You're already on the mountain — Day ${user.current_day}. Reply anytime to reflect.`,
    );
    return;
  }
  await completeOnboardingAndActivate(supabase, user);
}

/** Unsubscribes a participant: updates status, and confirms via a direct reply — no AI involved. */
async function handleOptOut(supabase: Supabase, user: Pick<UserRow, "phone_number" | "channel">): Promise<void> {
  await supabase.from("users").update({ status: "opted_out" }).eq("phone_number", user.phone_number);

  await sendAndLog(
    supabase,
    user,
    "freeform",
    "You've been unsubscribed from 30 Days on the Mount and won't receive further daily messages. If you'd like to rejoin in the future, just message us again.",
  );
}

async function runSwitchboard(supabase: Supabase, user: UserRow, text: string) {
  // 1. Static ice-breaker intercepts — exact match, before any AI call,
  // available at any point in the conversation (including mid-onboarding).
  // Object.hasOwn, not a bare index: `text` is raw inbound SMS, so a
  // participant texting "constructor" / "toString" / "valueOf" would
  // otherwise pull a function off Object.prototype, pass the truthy check,
  // and get that function stringified back to them as the reply body.
  const staticReply = Object.hasOwn(ICE_BREAKER_RESPONSES, text) ? ICE_BREAKER_RESPONSES[text] : undefined;
  if (staticReply) {
    await sendAndLog(supabase, user, "freeform", staticReply);
    return;
  }

  if (isActivationTrigger(text) && user.status !== "pending") {
    // Already onboarded (or opted out/completed) — don't clobber their
    // progress by resending Day 0; just orient them. (A pending user hitting
    // this trigger is handled inside the onboarding state machine below,
    // since it's only a readiness signal when onboarding hasn't started.)
    await sendAndLog(supabase, user, "freeform", `You've already begun this journey — you're currently on Day ${user.current_day}.`);
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
    // Evening Check-In: evening_sent_at/evening_completed (set by the
    // evening-checkin cron, cleared by daily-push on day rollover) tell us
    // whether this reply is responding to tonight's check-in, across both
    // channels — no per-message template inference needed.
    if (user.evening_sent_at && !user.evening_completed) {
      const eveningSystemPrompt = await getEveningReflectionSystemPrompt();

      let eveningReply: string;
      try {
        eveningReply = await generateEveningReflectionReply(eveningSystemPrompt, text);
      } catch (error) {
        await logAiFailure(supabase, user, "Evening reflection reply failed", error);
        return;
      }

      await sendAndLog(supabase, user, "ai_generated", eveningReply);
      await supabase.from("users").update({ evening_completed: true }).eq("phone_number", user.phone_number);
      return;
    }

    const { data: curriculumDay } = await supabase
      .from("curriculum_days")
      .select("*")
      .eq("day_number", user.current_day)
      .maybeSingle();

    // First reply after today's short WhatsApp template teaser: the
    // template itself is a teaser (title, invitation, scripture) that fits
    // Meta's 1024-char limit — the full reflection (synopsis, key practice)
    // is sent here as a plain follow-up, not AI-generated, once the
    // participant replies to it. SMS participants already received the full
    // text directly in the push (see lib/messaging.ts sendPushToChannel,
    // which has no such length/template constraint), so this step only
    // applies to WhatsApp.
    if (user.channel === "whatsapp" && curriculumDay) {
      const lastTemplateBody = await getMostRecentOutboundTemplate(supabase, user.phone_number);
      if (lastTemplateBody === `[template:${curriculumDay.template_name}]`) {
        await sendAndLog(supabase, user, "freeform", curriculumDay.fallback_text);
        return;
      }
    }

    // Otherwise: day-aware reflection AI.
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
      await logAiFailure(supabase, user, "AI reflection reply failed", error);
      return;
    }

    await sendAndLog(supabase, user, "ai_generated", reply);
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
      // A deterministic readiness signal (the ice-breaker button text, or
      // the "START" opt-in keyword) — no need to spend an AI call
      // confirming what we already know.
      if (isActivationTrigger(text)) {
        await beginOnboarding(supabase, user);
        return;
      }

      let gatekeeperReply: string;
      try {
        gatekeeperReply = await generateGatekeeperReply(text);
      } catch (error) {
        await logAiFailure(supabase, user, "Gatekeeper reply failed", error);
        return;
      }

      if (gatekeeperReply.trim() === GATEKEEPER_TRIGGER) {
        // Intercepted server-side — the trigger string itself is never sent
        // to the participant. Only the name prompt goes out.
        await beginOnboarding(supabase, user);
        return;
      }

      await sendAndLog(supabase, user, "ai_generated", gatekeeperReply);
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
        user,
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
        await logAiFailure(supabase, user, "Preferred-hour extraction failed", error);
        return;
      }

      if (hour === null) {
        await sendAndLog(
          supabase,
          user,
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
        user,
        "freeform",
        "Got it. Would you also like to receive your daily invitation by email, in addition to what you get here?",
      );
      return;
    }

    case "awaiting_email_pref": {
      let wantsEmail: boolean | null;
      try {
        wantsEmail = await detectYesNo(text);
      } catch (error) {
        await logAiFailure(supabase, user, "Email-preference detection failed", error);
        return;
      }

      if (wantsEmail === null) {
        await sendAndLog(supabase, user, "freeform", "Just a simple yes or no — would you like email too?");
        return;
      }

      if (!wantsEmail) {
        await supabase.from("users").update({ wants_email: false }).eq("phone_number", user.phone_number);
        await completeOnboardingAndActivate(supabase, user);
        return;
      }

      await supabase
        .from("users")
        .update({ wants_email: true, onboarding_step: "awaiting_email_address" })
        .eq("phone_number", user.phone_number);
      await sendAndLog(supabase, user, "freeform", "Wonderful — what email address should I use?");
      return;
    }

    case "awaiting_email_address": {
      const email = text.trim();
      if (!EMAIL_PATTERN.test(email)) {
        await sendAndLog(supabase, user, "freeform", "That doesn't look like a valid email address — could you send it again?");
        return;
      }

      await supabase.from("users").update({ email_address: email }).eq("phone_number", user.phone_number);
      await completeOnboardingAndActivate(supabase, user);
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
async function beginOnboarding(supabase: Supabase, user: UserRow): Promise<void> {
  await supabase.from("users").update({ onboarding_step: "awaiting_name" }).eq("phone_number", user.phone_number);
  await sendAndLog(supabase, user, "freeform", "I'm so glad you're here. What name would you like me to call you?");
}

/** Marks onboarding complete, activates the participant on Day 0, and sends the Day 0 welcome push. */
async function completeOnboardingAndActivate(supabase: Supabase, user: UserRow): Promise<void> {
  await supabase
    .from("users")
    .update({
      status: "active",
      current_day: 0,
      onboarding_step: "completed",
      access_tier: "premium",
      premium_granted_at: new Date().toISOString(),
      // Day 0 goes out below, so today's push is already spent. Without this
      // stamp the daily-push cron would see a participant past their delivery
      // hour with no push recorded and send Day 1 on the same day they were
      // welcomed — two days of curriculum in one day.
      last_push_on: getLocalDate(user.timezone || DEFAULT_TIMEZONE, new Date()),
    })
    .eq("phone_number", user.phone_number);

  const { data: welcomeDay } = await supabase
    .from("curriculum_days")
    .select("template_name, title, fallback_text")
    .eq("day_number", 0)
    .maybeSingle();

  const templateName = welcomeDay?.template_name ?? "day_00_welcome";
  // A2P 10DLC: the opt-in confirmation (first message) must carry the
  // program disclosures. Appended at send time only — the stored curriculum
  // welcome content is left untouched.
  const complianceFooter =
    "30 Days on the Mount is operated by The Matterworks LLC. Msg frequency varies. Msg&data rates may apply. Reply HELP for help, STOP to cancel.";
  const welcomeText = welcomeDay
    ? `${welcomeDay.title}\n\n${welcomeDay.fallback_text}`
    : "Welcome to 30 Days on the Mount.";
  const smsBody = `${welcomeText}\n\n${complianceFooter}`;
  const result = await sendPushToChannel(user.channel, user.phone_number, templateName, smsBody);

  await logMessage(supabase, {
    phoneNumber: user.phone_number,
    direction: "outbound",
    messageType: "template",
    body: `[template:${templateName}]`,
    providerMessageId: result.messageId,
    status: result.ok ? "sent" : "failed",
    channel: user.channel,
  });
}

/**
 * The message_body of the most recent outbound template sent to this
 * participant (e.g. `[template:day_01_poor_in_spirit]`), or null if none.
 * Templates are logged in that exact `[template:<name>]` shape by
 * completeOnboardingAndActivate and the daily-push cron alike — used to
 * infer what a WhatsApp freeform reply is probably responding to.
 */
async function getMostRecentOutboundTemplate(supabase: Supabase, phoneNumber: string): Promise<string | null> {
  const { data } = await supabase
    .from("message_logs")
    .select("message_body")
    .eq("phone_number", phoneNumber)
    .eq("direction", "outbound")
    .eq("message_type", "template")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.message_body ?? null;
}

/** Sends a freeform reply on the participant's locked-in channel and logs the outcome. */
async function sendAndLog(
  supabase: Supabase,
  user: Pick<UserRow, "phone_number" | "channel">,
  messageType: MessageType,
  body: string,
) {
  const result = await sendFreeformToChannel(user.channel, user.phone_number, body);
  await logMessage(supabase, {
    phoneNumber: user.phone_number,
    direction: "outbound",
    messageType,
    body,
    providerMessageId: result.messageId,
    status: result.ok ? "sent" : "failed",
    channel: user.channel,
  });
}

/**
 * Logs an AI engine failure as a visible message_logs row (status: failed)
 * instead of silently dropping the reply — this is what makes AI
 * misconfiguration (e.g. a bad AI_API_KEY) show up in the Live Conversation
 * Inbox rather than only in Vercel's function logs.
 */
async function logAiFailure(
  supabase: Supabase,
  user: Pick<UserRow, "phone_number" | "channel">,
  context: string,
  error: unknown,
) {
  const messageText = error instanceof Error ? error.message : "Unknown AI engine error";
  console.error(context, error);
  await logMessage(supabase, {
    phoneNumber: user.phone_number,
    direction: "outbound",
    messageType: "ai_generated",
    body: `[AI reply failed: ${messageText}]`,
    providerMessageId: null,
    status: "failed",
    channel: user.channel,
  });
}

async function logMessage(
  supabase: Supabase,
  params: {
    phoneNumber: string;
    direction: "inbound" | "outbound";
    messageType: MessageType;
    body: string;
    providerMessageId: string | null;
    status: MessageStatus;
    channel: MessageChannel;
  },
) {
  await supabase.from("message_logs").insert({
    phone_number: params.phoneNumber,
    direction: params.direction,
    message_type: params.messageType,
    message_body: params.body,
    provider_message_id: params.providerMessageId,
    status: params.status,
    channel: params.channel,
  });
}
