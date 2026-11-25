import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  MAX_CODE_ATTEMPTS,
  MAX_CODES_PER_HOUR,
  SIGN_IN_CODE_TTL_SECONDS,
  codesMatch,
  generateSignInCode,
  hashSignInCode,
} from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";
import { DEFAULT_TIMEZONE, getLocalDate } from "@/lib/timezone";

/**
 * Accounts for people who'd rather not give a phone number: Sign in with
 * Apple, or a code sent by email.
 *
 * Every participant table is keyed by users.phone_number, so these accounts
 * get a key in the same column that can never be mistaken for a number —
 * "apple:" or "email:" and a hash of the Apple user ID or the address. They
 * are app-only (channel 'app'): nothing here is consent to be texted, and
 * lib/twilio.ts refuses to text a key that isn't digits.
 */

const KEY_LENGTH = 20; // users.phone_number is varchar(20)

export type AccountKind = "apple" | "email";

export function accountKey(kind: AccountKind, subject: string): string {
  const prefix = `${kind}:`;
  const hash = crypto.createHash("sha256").update(subject).digest("hex");
  return prefix + hash.slice(0, KEY_LENGTH - prefix.length);
}

/** How a participant signs in, read from their key. */
export function signInMethod(key: string): "phone" | AccountKind {
  if (key.startsWith("apple:")) return "apple";
  if (key.startsWith("email:")) return "email";
  return "phone";
}

export function canonicalEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

/**
 * Someone already on the journey keeps everything: their day, their
 * conversation, and the channel they consented to be texted on.
 *
 * Someone new — or still in the SMS waiting room, never having opted in —
 * begins in the app on Day 1, today. Their channel is 'app': they agreed to a
 * sign-in, not to daily texts, so the program never texts them.
 * last_push_on is stamped with today's date so tomorrow morning's push
 * delivers Day 2 rather than repeating Day 1.
 */
export async function ensureParticipant(key: string, firstName?: string | null): Promise<UserRow | null> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("users").select("*").eq("phone_number", key).maybeSingle();
  if (existing && existing.status !== "pending") return existing;

  const now = new Date();
  const timezone = existing?.timezone || DEFAULT_TIMEZONE;
  const today = getLocalDate(timezone, now) ?? getLocalDate(DEFAULT_TIMEZONE, now);
  const activation = {
    status: "active" as const,
    current_day: 1,
    onboarding_step: "completed" as const,
    channel: "app" as const,
    access_tier: "premium" as const,
    premium_granted_at: now.toISOString(),
    last_push_on: today,
    last_interaction_at: now.toISOString(),
    ...(firstName && !existing?.first_name ? { first_name: firstName.slice(0, 60) } : {}),
  };

  const { data } = existing
    ? await supabase.from("users").update(activation).eq("phone_number", key).select().single()
    : await supabase.from("users").insert({ phone_number: key, ...activation }).select().single();
  return data ?? null;
}

// MARK: - One-time codes

/**
 * Stores a fresh code for `key` and returns it, or the response to send if
 * too many have been asked for. Sends are counted per rolling hour so the
 * endpoint can't be used to flood someone.
 */
export async function issueSignInCode(key: string): Promise<{ code: string } | { response: NextResponse }> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("sign_in_codes").select("*").eq("phone_number", key).maybeSingle();

  const now = Date.now();
  let sendsInWindow = 1;
  let windowStartedAt = new Date(now).toISOString();
  if (existing && now - Date.parse(existing.window_started_at) < 60 * 60 * 1000) {
    if (existing.sends_in_window >= MAX_CODES_PER_HOUR) {
      return { response: NextResponse.json({ error: "Too many codes requested. Try again in an hour." }, { status: 429 }) };
    }
    sendsInWindow = existing.sends_in_window + 1;
    windowStartedAt = existing.window_started_at;
  }

  const code = generateSignInCode();
  const { error } = await supabase.from("sign_in_codes").upsert({
    phone_number: key,
    code_hash: hashSignInCode(key, code),
    expires_at: new Date(now + SIGN_IN_CODE_TTL_SECONDS * 1000).toISOString(),
    attempts: 0,
    sends_in_window: sendsInWindow,
    window_started_at: windowStartedAt,
  });
  if (error) {
    console.error("Could not store sign-in code", error);
    return { response: NextResponse.json({ error: "Sign-in is unavailable right now. Please try again." }, { status: 500 }) };
  }
  return { code };
}

/** Checks and spends a code. Returns null when it's good, else the response to send. */
export async function consumeSignInCode(key: string, code: string): Promise<NextResponse | null> {
  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase.from("sign_in_codes").select("*").eq("phone_number", key).maybeSingle();
  if (!row || Date.parse(row.expires_at) < Date.now()) {
    return NextResponse.json({ error: "That code has expired. Request a new one." }, { status: 400 });
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    await supabase.from("sign_in_codes").delete().eq("phone_number", key);
    return NextResponse.json({ error: "Too many tries. Request a new code." }, { status: 429 });
  }
  if (!codesMatch(row.code_hash, key, code)) {
    await supabase.from("sign_in_codes").update({ attempts: row.attempts + 1 }).eq("phone_number", key);
    return NextResponse.json({ error: "That code doesn't match. Check the latest message and try again." }, { status: 400 });
  }
  // Single use.
  await supabase.from("sign_in_codes").delete().eq("phone_number", key);
  return null;
}

// MARK: - Email

export function isEmailSignInConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendSignInCodeEmail(to: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "30 Days on the Mount <onboarding@30daysonthemount.com>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `${code} is your sign-in code`,
        text: `${code} is your 30 Days on the Mount sign-in code. It expires in 10 minutes.\n\nIf you didn't ask for it, you can ignore this email.`,
      }),
    });
    if (!response.ok) console.error("Sign-in email failed", response.status, await response.text().catch(() => ""));
    return response.ok;
  } catch (error) {
    console.error("Sign-in email request threw", error);
    return false;
  }
}

// MARK: - Sign in with Apple

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_AUDIENCE = process.env.APNS_TOPIC?.trim() || "com.thematterworks.mount";

type AppleKey = { kid: string; kty: string; alg: string; n: string; e: string; use?: string };
let appleKeys: { keys: AppleKey[]; fetchedAt: number } | null = null;

async function appleKey(kid: string): Promise<AppleKey | undefined> {
  const stale = !appleKeys || Date.now() - appleKeys.fetchedAt > 60 * 60 * 1000;
  if (stale || !appleKeys?.keys.some((key) => key.kid === kid)) {
    const response = await fetch(`${APPLE_ISSUER}/auth/keys`);
    if (!response.ok) return undefined;
    appleKeys = { keys: ((await response.json()) as { keys: AppleKey[] }).keys, fetchedAt: Date.now() };
  }
  return appleKeys?.keys.find((key) => key.kid === kid);
}

/**
 * Verifies the identity token the app receives from Sign in with Apple —
 * signed by Apple, issued for this app, unexpired — and returns Apple's
 * stable user ID for it.
 */
export async function verifyAppleIdentityToken(token: string): Promise<{ subject: string } | null> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
  try {
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString()) as { kid?: string; alg?: string };
    if (header.alg !== "RS256" || !header.kid) return null;
    const jwk = await appleKey(header.kid);
    if (!jwk) return null;

    const valid = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      crypto.createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(encodedSignature, "base64url"),
    );
    if (!valid) return null;

    const claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as {
      iss?: string;
      aud?: string;
      exp?: number;
      sub?: string;
    };
    if (claims.iss !== APPLE_ISSUER || claims.aud !== APPLE_AUDIENCE || !claims.sub) return null;
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
    return { subject: claims.sub };
  } catch {
    return null;
  }
}
