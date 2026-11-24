import "server-only";
import { sendFreeformTextMessage, sendTemplateMessage } from "@/lib/whatsapp";
import { sendSmsMessage } from "@/lib/twilio";
import type { MessageChannel } from "@/lib/supabase/types";
import { timed } from "@/lib/timing";
import { type AppNotification, sendAppNotification } from "@/lib/apns";

export interface ChannelSendResult {
  ok: boolean;
  messageId: string | null;
  error: string | null;
  /**
   * Provider-specific numeric error code, when there is one. Only the SMS
   * path populates it (see lib/twilio.ts); WhatsApp sends leave it undefined.
   */
  code?: number | null;
}

/**
 * Twilio error 21610 — "message cannot be sent to an unsubscribed recipient".
 *
 * This is how a STOP that never reached our webhook becomes visible. Twilio's
 * Advanced Opt-Out intercepts STOP/UNSUBSCRIBE/CANCEL at their edge and
 * blocks the number without forwarding the message, so
 * lib/conversation-engine.ts's handleOptOut never runs and `users.status`
 * stays 'active'. The cron then retries that number every day forever, and
 * each attempt is a compliance-relevant send to someone who has opted out.
 *
 * Treating 21610 as an authoritative opt-out signal reconciles our database
 * with Twilio's suppression list on the first failed send.
 */
export const TWILIO_UNSUBSCRIBED_ERROR_CODE = 21610;

/** True if a send failed specifically because the recipient has opted out at the carrier/Twilio level. */
export function isUnsubscribedRecipientError(result: ChannelSendResult): boolean {
  return !result.ok && result.code === TWILIO_UNSUBSCRIBED_ERROR_CODE;
}

/** Sends a freeform reply on whichever channel the participant is locked into. */
export async function sendFreeformToChannel(
  channel: MessageChannel,
  to: string,
  body: string,
): Promise<ChannelSendResult> {
  if (channel === "app") {
    // A companion reply to someone using the app is read in the app: the
    // caller logs it to message_logs and the app fetches it from there
    // (GET /api/mobile/companion). Nothing goes out over a carrier.
    return { ok: true, messageId: null, error: null };
  }
  if (channel === "sms") {
    return timed("send:twilio", () => sendSmsMessage(to, body));
  }
  return timed("send:whatsapp", () => sendFreeformTextMessage(to, body));
}

/**
 * Dispatches a cron-initiated "push" message (daily curriculum, evening
 * check-in) on whichever channel the participant is locked into.
 *
 * WhatsApp requires a pre-approved Meta template for any message sent
 * outside the 24-hour customer-service window, which is exactly the case
 * for a cron-initiated push — so whatsappTemplateName is sent as-is via the
 * Graph API template endpoint. Twilio SMS has no equivalent pre-approval
 * mechanism, so smsBody is sent directly as the full message text.
 */
export async function sendPushToChannel(
  channel: MessageChannel,
  to: string,
  whatsappTemplateName: string,
  smsBody: string,
): Promise<ChannelSendResult> {
  // A participant who joined through the app has consented to a sign-in
  // code, not to daily texts, so they are never sent the program by SMS. Their
  // day unlocks in the app; reporting success is what lets the cron advance
  // current_day. Push notifications deliver the invitation itself
  // (ios/ARCHITECTURE.md, Phase 3).
  if (channel === "app") {
    return { ok: true, messageId: null, error: null };
  }
  if (channel === "sms") {
    return timed("send:twilio", () => sendSmsMessage(to, smsBody));
  }
  return timed("send:whatsapp", () => sendTemplateMessage(to, whatsappTemplateName));
}

/**
 * Delivers a scheduled program message (the morning day, the evening
 * check-in). The app comes first: a participant signed in on a phone that
 * allows notifications gets a push, and nothing else. Anyone else gets their
 * consented channel exactly as before — which, for someone who joined through
 * the app, is nothing at all (see sendPushToChannel).
 *
 * `channel` in the result is where it actually went, for message_logs.
 */
export async function deliverProgramMessage(params: {
  user: { phone_number: string; channel: MessageChannel };
  whatsappTemplateName: string;
  smsBody: string;
  notification: AppNotification;
}): Promise<ChannelSendResult & { channel: MessageChannel }> {
  const { user } = params;
  const pushed = await sendAppNotification(user.phone_number, params.notification);
  if (pushed > 0) {
    return { ok: true, messageId: null, error: null, channel: "app" };
  }
  const result = await sendPushToChannel(user.channel, user.phone_number, params.whatsappTemplateName, params.smsBody);
  return { ...result, channel: user.channel };
}
