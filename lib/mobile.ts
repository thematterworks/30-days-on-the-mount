import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyParticipantSessionToken } from "@/lib/participant-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";

/**
 * Shared plumbing for the native app's API (app/api/mobile/*).
 *
 * The app authenticates with a bearer token rather than a cookie. It is the
 * same signed participant-session token the /journey web app uses
 * (createParticipantSessionToken), so there is one session format and one
 * secret; only the transport differs.
 */

export const SIGN_IN_CODE_TTL_SECONDS = 10 * 60;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_CODES_PER_HOUR = 5;

/**
 * Canonical digit-only phone ("13109028045") — the key every participant table
 * uses, and the same rules as the app's PhoneNumber.canonical. Ten digits are
 * read as a US number.
 */
export function canonicalPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  if (digits.length >= 12 && digits.length <= 15 && trimmed.startsWith("+")) return digits;
  return null;
}

/** Six random digits from a CSPRNG. */
export function generateSignInCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Only a keyed hash of a code is stored. Keyed with the session secret and
 * bound to the phone number, so a leaked row can't be brute-forced offline
 * across the six-digit space or replayed for another number.
 */
export function hashSignInCode(phone: string, code: string): string {
  return crypto.createHmac("sha256", env.PARTICIPANT_SESSION_SECRET).update(`${phone}:${code}`).digest("hex");
}

export function codesMatch(expectedHash: string, phone: string, code: string): boolean {
  const actual = Buffer.from(hashSignInCode(phone, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * App Store review needs a way in that doesn't depend on receiving a text.
 * Set MOBILE_REVIEW_PHONE and MOBILE_REVIEW_CODE to enable a single fixed
 * login; leave them unset everywhere else and this never matches.
 */
export function isReviewLogin(phone: string, code?: string): boolean {
  const reviewPhone = canonicalPhone(process.env.MOBILE_REVIEW_PHONE ?? "");
  const reviewCode = process.env.MOBILE_REVIEW_CODE?.trim();
  if (!reviewPhone || !reviewCode || phone !== reviewPhone) return false;
  return code === undefined || code === reviewCode;
}

/** Resolves the participant behind `Authorization: Bearer <token>`. */
export async function getMobileParticipant(request: Request): Promise<UserRow | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  const session = await verifyParticipantSessionToken(token);
  if (!session) return null;
  const { data: user } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("phone_number", session.phone_number)
    .maybeSingle();
  return user ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** The participant as the app sees them. */
export function participantPayload(user: UserRow) {
  return {
    phoneNumber: user.phone_number,
    firstName: user.first_name,
    status: user.status,
    currentDay: user.current_day,
    timezone: user.timezone,
    preferredHour: user.preferred_delivery_hour,
    channel: user.channel,
  };
}
