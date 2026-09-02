import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";

// Participant (/journey PWA) auth. Two distinct primitives:
//
//   1. Magic links — one-time, expiring, DB-backed login tokens delivered
//      via the participant's daily premium text. Only a sha256 hash is
//      stored; the raw token lives only in the delivered link. Exchanged
//      once at /journey/enter for a session cookie.
//
//   2. Session cookie — a stateless, HMAC-signed HttpOnly cookie carrying
//      { phone_number, exp }, mechanically identical to the admin session
//      in lib/auth.ts but keyed with PARTICIPANT_SESSION_SECRET so a leak
//      of one secret can never forge the other.

export const PARTICIPANT_SESSION_COOKIE = "mount_journey_session";
export const PARTICIPANT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days
// The link in the daily text acts as a persistent "open app" key for the
// duration of the challenge — not a one-shot token. It is intentionally NOT
// single-use (see verifyMagicLink): a participant taps the same link every
// day. Prefetch safety comes from the GET-peek / POST-button flow in
// app/journey/enter/page.tsx, not from burning the token.
export const MAGIC_LINK_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Origin used to build magic-link URLs. Overridable for preview deploys. */
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.30daysonthemount.com";

interface ParticipantSessionPayload {
  phone_number: string;
  exp: number; // unix seconds
}

// ============================================================================
// base64url helpers (WebCrypto-friendly, edge-safe) — same as lib/auth.ts
// ============================================================================

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// ============================================================================
// Session cookie: sign / verify (pure crypto, no DB)
// ============================================================================

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.PARTICIPANT_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Signs a participant session cookie: base64url(payload).base64url(hmac-sha256). */
export async function createParticipantSessionToken(phoneNumber: string): Promise<string> {
  const payload: ParticipantSessionPayload = {
    phone_number: phoneNumber,
    exp: Math.floor(Date.now() / 1000) + PARTICIPANT_SESSION_MAX_AGE_SECONDS,
  };
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Verifies a participant session cookie and returns the payload if valid and unexpired. */
export async function verifyParticipantSessionToken(
  token: string | undefined,
): Promise<ParticipantSessionPayload | null> {
  if (!token) return null;
  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) return null;

  const key = await getHmacKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signatureB64) as BufferSource,
    new TextEncoder().encode(payloadB64),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as ParticipantSessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// Magic links: mint / consume (DB-backed)
// ============================================================================

/** Generates a 256-bit URL-safe token; only its sha256 is persisted. */
function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** sha256(token) as lowercase hex — what actually lands in magic_links.token_hash. */
async function hashToken(rawToken: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Highest day with a page, matching the curriculum_days 0-31 range (day 0 has no page). */
export const MAX_JOURNEY_DAY = 31;

/**
 * Parses a magic link's `d` (destination day) parameter.
 *
 * Deliberately narrow: a magic link may only ever carry a day *number*, never
 * a path or URL, and the destination path is assembled server-side from the
 * parsed integer. That is what keeps `/journey/enter` from being an open
 * redirect — an attacker who obtains a link cannot repoint it anywhere, only
 * choose a day, and the day page still gates that against the participant's
 * own current_day. Returns null for anything unparseable, so callers fall
 * back to the journey index rather than failing.
 */
export function parseJourneyDay(value: string | undefined): number | null {
  if (!value || !/^\d{1,2}$/.test(value)) return null;
  const day = Number(value);
  return day >= 1 && day <= MAX_JOURNEY_DAY ? day : null;
}

/**
 * Builds the participant-facing magic link. When `dayNumber` is given the
 * link carries it as `d`, so `/journey/enter` can land the participant on
 * that day's page instead of the journey index once the session is set.
 */
export function buildMagicLinkUrl(rawToken: string, dayNumber?: number): string {
  const base = `${SITE_ORIGIN}/journey/enter?t=${rawToken}`;
  const day = parseJourneyDay(dayNumber === undefined ? undefined : String(dayNumber));
  return day === null ? base : `${base}&d=${day}`;
}

/**
 * Mints a one-time magic link for a participant: stores the token hash with
 * a MAGIC_LINK_TTL_SECONDS expiry (30 days) and returns the ready-to-send URL
 * (containing the raw token, which is never persisted). Pass `dayNumber` to
 * deep-link the participant to that day. Caller is responsible for delivery
 * via lib/messaging.ts.
 */
export async function mintMagicLink(
  phoneNumber: string,
  dayNumber?: number,
): Promise<{ url: string; expiresAt: string } | null> {
  const rawToken = generateRawToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000).toISOString();

  const { error } = await getSupabaseAdmin()
    .from("magic_links")
    .insert({ phone_number: phoneNumber, token_hash: tokenHash, expires_at: expiresAt });

  if (error) {
    console.error("Failed to mint magic link for", phoneNumber, error);
    return null;
  }

  return { url: buildMagicLinkUrl(rawToken, dayNumber), expiresAt };
}

/**
 * Read-only check that a token currently exists and hasn't expired — WITHOUT
 * consuming it, and deliberately IGNORING consumed_at (the link is a
 * persistent 30-day key, reusable every day). Safe to call from a GET
 * (including a background link-unfurl / prefetch), so the /journey/enter
 * page can decide whether to show the "enter" button or an expired notice.
 */
export async function peekMagicLinkValid(rawToken: string): Promise<boolean> {
  if (!rawToken) return false;
  const tokenHash = await hashToken(rawToken);
  const { data } = await getSupabaseAdmin()
    .from("magic_links")
    .select("id")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

/**
 * Verifies a magic-link token and returns its phone_number, or null if the
 * token is unknown or expired (older than 30 days). Non-consuming by design:
 * consumed_at is neither checked nor written, so the same link keeps working
 * for the whole challenge and a fresh session cookie is minted on each use.
 * Called only from the explicit POST in app/journey/enter/page.tsx.
 */
export async function verifyMagicLink(rawToken: string): Promise<string | null> {
  if (!rawToken) return null;
  const tokenHash = await hashToken(rawToken);

  const { data, error } = await getSupabaseAdmin()
    .from("magic_links")
    .select("phone_number")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Failed to verify magic link", error);
    return null;
  }
  return data?.phone_number ?? null;
}

/** Deletes magic links that expired more than a week ago. Cheap housekeeping; safe to call from any cron. */
export async function cleanupExpiredMagicLinks(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await getSupabaseAdmin().from("magic_links").delete().lt("expires_at", cutoff);
}

// ============================================================================
// Current participant (for /journey server components)
// ============================================================================

/**
 * Resolves the currently signed-in participant for a /journey request:
 * reads and verifies the session cookie, loads the user, and enforces the
 * gate — active status AND premium tier. Returns null if any check fails,
 * so a downgraded or paused participant with a still-valid cookie is
 * bounced on the very next page load (defense in depth alongside only ever
 * sending magic links to premium users).
 */
export async function getCurrentParticipant(): Promise<UserRow | null> {
  const cookieStore = await cookies();
  const session = await verifyParticipantSessionToken(cookieStore.get(PARTICIPANT_SESSION_COOKIE)?.value);
  if (!session) return null;

  const { data: user } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("phone_number", session.phone_number)
    .maybeSingle();

  if (!user || user.status !== "active" || user.access_tier !== "premium") {
    return null;
  }
  return user;
}
