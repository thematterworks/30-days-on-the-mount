import "server-only";
import { sendFreeformTextMessage, sendTemplateMessage } from "@/lib/whatsapp";
import { sendSmsMessage } from "@/lib/twilio";
import type { MessageChannel } from "@/lib/supabase/types";

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
  if (channel === "sms") {
    return sendSmsMessage(to, body);
  }
  return sendFreeformTextMessage(to, body);
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
  if (channel === "sms") {
    return sendSmsMessage(to, smsBody);
  }
  return sendTemplateMessage(to, whatsappTemplateName);
}
