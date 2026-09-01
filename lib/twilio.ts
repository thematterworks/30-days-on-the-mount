import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

const API_BASE = "https://api.twilio.com/2010-04-01";

interface TwilioSendResult {
  ok: boolean;
  messageId: string | null;
  error: string | null;
  /**
   * Twilio's numeric error code, when the API returned one. Surfaced so
   * callers can react to specific failures rather than just logging a
   * string — most importantly 21610 ("message cannot be sent to an
   * unsubscribed recipient"), which is how a STOP that Twilio's own
   * Advanced Opt-Out intercepted before our webhook ever saw it becomes
   * visible to us. See the note on Advanced Opt-Out in
   * app/api/webhook/sms/route.ts.
   */
  code: number | null;
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
    return { ok: false, messageId: null, error: message, code: null };
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Twilio API request failed:", {
      status: response.status,
      error: payload,
    });
    const message = payload?.message ?? `Twilio API responded with status ${response.status}`;
    const code = typeof payload?.code === "number" ? payload.code : null;
    return { ok: false, messageId: null, error: message, code };
  }

  const messageId: string | null = payload?.sid ?? null;
  return { ok: true, messageId, error: null, code: null };
}

export interface InboundSmsMessage {
  from: string;
  text: string;
  messageSid: string;
  /** Number of media attachments on an inbound MMS (0 for a plain SMS). */
  numMedia: number;
}

/** Parses Twilio's inbound SMS webhook form fields (already decoded into a plain object by the caller). */
export function parseTwilioInboundParams(params: Record<string, string>): InboundSmsMessage | null {
  const from = params.From;
  const body = params.Body;
  const messageSid = params.MessageSid;
  if (!from || typeof body !== "string" || !messageSid) return null;

  // Twilio always sends NumMedia on Programmable Messaging webhooks, but it
  // arrives as a string and is absent on some console test posts.
  const parsedNumMedia = Number.parseInt(params.NumMedia ?? "0", 10);
  const numMedia = Number.isNaN(parsedNumMedia) ? 0 : parsedNumMedia;

  return { from: normalizePhoneNumber(from), text: body, messageSid, numMedia };
}

/**
 * Verifies the X-Twilio-Signature header per Twilio's documented algorithm:
 * HMAC-SHA1 (keyed with the Auth Token) over the full request URL with all
 * POST parameters — sorted by key, appended as `key + value` pairs — then
 * base64-encoded. Protects the inbound webhook from spoofed requests
 * (forged STOP/HELP replies, fake reflections, etc.), the SMS equivalent of
 * WhatsApp's hub.verify_token handshake.
 *
 * Verified against Twilio's published test vector: URL
 * "https://mycompany.com/myapp.php?foo=1&bar=2" with the documented example
 * params and auth token "12345" produces "RSOYDt4T1cUTdK1PDd93/VVr8B8=".
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

/**
 * Builds the list of URLs the signature could legitimately have been
 * computed over.
 *
 * Twilio signs the exact URL *it* was configured to call. Behind Vercel's
 * proxy, `request.url` does not reliably reproduce that string: TLS
 * terminates at the edge, so the protocol can come through as http, and the
 * host can be the deployment host rather than the custom domain the webhook
 * is configured with. A mismatch of a single character fails the HMAC, and
 * the failure mode is silent — a 403 that Twilio logs as error 11200 while
 * the participant simply never gets a reply.
 *
 * So we reconstruct the public URL from the forwarded headers Vercel sets
 * (x-forwarded-proto + x-forwarded-host/host) and check that alongside the
 * raw request.url, plus an explicit TWILIO_WEBHOOK_URL override for setups
 * where a redirect or CDN sits in front of the app and neither derivation
 * matches what Twilio was given.
 *
 * Checking several candidates does not weaken the check: each candidate is
 * still an HMAC keyed with the Auth Token, so an attacker who cannot forge
 * the signature for one URL cannot forge it for any of them.
 */
export function twilioWebhookUrlCandidates(requestUrl: string, headers: Headers): string[] {
  const candidates: string[] = [];

  const explicit = process.env.TWILIO_WEBHOOK_URL?.trim();
  if (explicit) {
    candidates.push(explicit);
  }

  try {
    const parsed = new URL(requestUrl);
    const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? headers.get("host")?.trim();

    if (forwardedProto) parsed.protocol = `${forwardedProto}:`;
    if (forwardedHost) {
      // hostname/port must be set separately, not via `parsed.host`: the host
      // setter leaves the existing port in place when the value it's given
      // has none, which would turn a localhost:3999 request into
      // "https://www.example.com:3999/..." and fail the HMAC.
      const [hostname, port = ""] = forwardedHost.split(":");
      parsed.hostname = hostname;
      parsed.port = port;
    }
    candidates.push(parsed.toString());
  } catch {
    // Unparseable request.url — fall through to the raw value below.
  }

  candidates.push(requestUrl);

  return [...new Set(candidates)];
}

/** Convenience wrapper: true if the signature matches any legitimate candidate URL. */
export function verifyTwilioSignatureForRequest(
  requestUrl: string,
  headers: Headers,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  if (!signature) return false;
  return twilioWebhookUrlCandidates(requestUrl, headers).some((url) =>
    verifyTwilioSignature(url, params, signature),
  );
}
