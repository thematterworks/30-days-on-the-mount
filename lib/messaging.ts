import "server-only";
import { sendFreeformTextMessage, sendTemplateMessage } from "@/lib/whatsapp";
import { sendSmsMessage } from "@/lib/twilio";
import type { MessageChannel } from "@/lib/supabase/types";

export interface ChannelSendResult {
  ok: boolean;
  messageId: string | null;
  error: string | null;
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
