import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

const API_BASE = "https://api.twilio.com/2010-04-01";

interface TwilioSendResult {
  ok: boolean;
  messageId: string | null;
  error: string | null;
}

/**
 * Converts our canonical digit-only phone_number (e.g. "13109028045", no
 * leading +, matching the format Meta's WhatsApp webhook already sends)
 * into the E.164 format Twilio's API requires.
 */
function toE164(phoneNumber: string): string {
  return phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;
}

/**
 * Strips a leading "+" so an inbound Twilio E.164 number matches this app's
 * canonical digit-only phone_number format, so the same participant is
 * recognized whether they message via WhatsApp or SMS.
 */
function normalizePhoneNumber(raw: string): string {
  return raw.startsWith("+") ? raw.slice(1) : raw;
}

/**
 * Sends an SMS (or MMS, if mediaUrl is given) via Twilio Programmable
 * Messaging. `to` is expected in this app's canonical digit-only phone
 * number format, same convention as lib/whatsapp.ts.
 */
export async function sendSmsMessage(to: string, body: string, mediaUrl?: string): Promise<TwilioSendResult> {
  const credentials = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({
    To: toE164(to),
    From: env.TWILIO_PHONE_NUMBER,
    Body: body,
  });
  if (mediaUrl) {
    params.set("MediaUrl", mediaUrl);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (error) {
    // Network-level failure — fetch itself threw before any HTTP response.
    console.error("Twilio API request threw before a response was received:", error);
    const message = error instanceof Error ? error.message : "Unknown Twilio API error";
    return { ok: false, messageId: null, error: message };
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Twilio API request failed:", {
      status: response.status,
      error: payload,
    });
    const message = payload?.message ?? `Twilio API responded with status ${response.status}`;
    return { ok: false, messageId: null, error: message };
  }

  const messageId: string | null = payload?.sid ?? null;
  return { ok: true, messageId, error: null };
}

export interface InboundSmsMessage {
  from: string;
  text: string;
  messageSid: string;
}

/** Parses Twilio's inbound SMS webhook form fields (already decoded into a plain object by the caller). */
export function parseTwilioInboundParams(params: Record<string, string>): InboundSmsMessage | null {
  const from = params.From;
  const body = params.Body;
  const messageSid = params.MessageSid;
  if (!from || typeof body !== "string" || !messageSid) return null;
  return { from: normalizePhoneNumber(from), text: body, messageSid };
}

/**
 * Verifies the X-Twilio-Signature header per Twilio's documented algorithm:
 * HMAC-SHA1 (keyed with the Auth Token) over the full request URL with all
 * POST parameters — sorted by key, appended as `key + value` pairs — then
 * base64-encoded. Protects the inbound webhook from spoofed requests
 * (forged STOP/HELP replies, fake reflections, etc.), the SMS equivalent of
 * WhatsApp's hub.verify_token handshake.
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  if (!signature) return false;

  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }

  const expected = crypto
    .createHmac("sha1", env.TWILIO_AUTH_TOKEN)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
