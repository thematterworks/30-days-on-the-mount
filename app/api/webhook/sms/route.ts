import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseTwilioInboundParams, verifyTwilioSignatureForRequest } from "@/lib/twilio";
import { handleInboundMessage } from "@/lib/conversation-engine";

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

/**
 * The webhook must ACK within Twilio's 15-second HTTP timeout, but the work
 * it defers (an Anthropic call plus several Supabase round-trips) can run
 * well past that. `after()` keeps running until the function's max duration,
 * so this ceiling applies to the deferred work, not to Twilio's wait.
 */
export const maxDuration = 60;

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
 * path, which handles the keywords correctly either way if they do arrive —
 * but when Twilio does intercept them, our `users.status` never learns about
 * it. The observable symptom is the daily-push cron failing against that
 * number with Twilio error 21610 (now surfaced as `code` on the send result
 * in lib/twilio.ts) every day thereafter.
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
  if (!verifyTwilioSignatureForRequest(request.url, request.headers, params, signature)) {
    // Logged because the failure is otherwise invisible from this side: Twilio
    // records error 11200 and the participant just never hears back. The URL
    // we derived is the thing that's almost always wrong (see
    // twilioWebhookUrlCandidates), so it's the thing worth printing.
    console.error("Rejected inbound SMS with an invalid X-Twilio-Signature", {
      hasSignature: Boolean(signature),
      requestUrl: request.url,
      forwardedProto: request.headers.get("x-forwarded-proto"),
      forwardedHost: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    });
    return new NextResponse("Forbidden", { status: 403 });
  }

  const inbound = parseTwilioInboundParams(params);
  if (inbound) {
    // A media-only MMS arrives with an empty Body. Passing "" straight through
    // would reach the AI engine as an empty user message, which the Anthropic
    // API rejects outright — so the participant would get silence. Substituting
    // a short description keeps them on the normal pastoral reply path.
    // (Attachments themselves are not downloaded or stored; only the fact that
    // one was sent reaches the conversation engine.)
    const text =
      inbound.text.trim() === "" && inbound.numMedia > 0
        ? "(sent a photo without any text)"
        : inbound.text;

    // Deferred so the 200 goes back inside Twilio's 15-second timeout. Our own
    // reply, if any, is sent by the engine over the Twilio REST API
    // (lib/twilio.ts sendSmsMessage) rather than in this response body, so
    // nothing about the reply depends on the request still being open.
    after(async () => {
      try {
        await handleInboundMessage({
          channel: "sms",
          from: inbound.from,
          text,
          providerMessageId: inbound.messageSid,
        });
      } catch (error) {
        console.error("Failed to process inbound SMS message", error);
      }
    });
  }

  // Empty TwiML: acknowledges receipt without Twilio auto-generating any reply.
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
