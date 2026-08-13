import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseTwilioInboundParams, verifyTwilioSignature } from "@/lib/twilio";
import { handleInboundMessage } from "@/lib/conversation-engine";

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

/**
 * Twilio Programmable Messaging inbound webhook. STOP/HELP and every other
 * compliance keyword are handled generically inside
 * lib/conversation-engine.ts's handleInboundMessage — the same code path
 * the WhatsApp webhook uses — so this route only needs to authenticate the
 * request and hand off a normalized inbound message.
 *
 * Note: Twilio's Advanced Opt-Out feature can intercept STOP/START/HELP
 * before this webhook ever sees them, depending on how the number/campaign
 * is configured in the Twilio console. That's independent of this code
 * path, which handles the keywords correctly either way if they do arrive.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(request.url, params, signature)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const inbound = parseTwilioInboundParams(params);
  if (inbound) {
    try {
      await handleInboundMessage({
        channel: "sms",
        from: inbound.from,
        text: inbound.text,
        providerMessageId: inbound.messageSid,
      });
    } catch (error) {
      console.error("Failed to process inbound SMS message", error);
    }
  }

  // Empty TwiML: acknowledges receipt without Twilio auto-generating any
  // reply. Our own reply, if any, was already sent asynchronously above via
  // the Twilio REST API (lib/twilio.ts sendSmsMessage), same pattern as the
  // WhatsApp webhook's outbound sends.
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
