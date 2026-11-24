import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MAX_CODE_ATTEMPTS, badRequest, canonicalPhone, codesMatch, isReviewLogin, participantPayload, readJson } from "@/lib/mobile";
import { createParticipantSessionToken } from "@/lib/participant-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";
import { DEFAULT_TIMEZONE, getLocalDate } from "@/lib/timezone";

/** Exchanges a texted code for a session token, creating the participant if needed. */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const phone = canonicalPhone(body.phoneNumber);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!phone || !/^\d{6}$/.test(code)) return badRequest("Enter the six-digit code from your text.");

  const supabase = getSupabaseAdmin();

  if (!isReviewLogin(phone, code)) {
    const { data: row } = await supabase.from("sign_in_codes").select("*").eq("phone_number", phone).maybeSingle();
    if (!row || Date.parse(row.expires_at) < Date.now()) {
      return badRequest("That code has expired. Request a new one.");
    }
    if (row.attempts >= MAX_CODE_ATTEMPTS) {
      await supabase.from("sign_in_codes").delete().eq("phone_number", phone);
      return NextResponse.json({ error: "Too many tries. Request a new code." }, { status: 429 });
    }
    if (!codesMatch(row.code_hash, phone, code)) {
      await supabase.from("sign_in_codes").update({ attempts: row.attempts + 1 }).eq("phone_number", phone);
      return badRequest("That code doesn't match. Check the latest text and try again.");
    }
    // Single use.
    await supabase.from("sign_in_codes").delete().eq("phone_number", phone);
  }

  const participant = await ensureParticipant(phone);
  if (!participant) {
    return NextResponse.json({ error: "Sign-in is unavailable right now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({
    token: await createParticipantSessionToken(phone),
    participant: participantPayload(participant),
  });
}

/**
 * Someone already on the journey keeps everything: their day, their
 * conversation, and the channel they consented to be texted on.
 *
 * Someone new — or still in the SMS waiting room, never having opted in —
 * begins in the app on Day 1, today. Their channel is 'app': they agreed to a
 * sign-in code, not to daily texts, so the program never texts them.
 * last_push_on is stamped with today's date so tomorrow morning's push
 * delivers Day 2 rather than repeating Day 1.
 */
async function ensureParticipant(phone: string): Promise<UserRow | null> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("users").select("*").eq("phone_number", phone).maybeSingle();
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
  };

  const { data } = existing
    ? await supabase.from("users").update(activation).eq("phone_number", phone).select().single()
    : await supabase.from("users").insert({ phone_number: phone, ...activation }).select().single();
  return data ?? null;
}
