import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MAX_CODE_ATTEMPTS, badRequest, canonicalPhone, codesMatch, isReviewLogin, participantPayload, readJson } from "@/lib/mobile";
import { createParticipantSessionToken } from "@/lib/participant-auth";
import { ensureParticipant } from "@/lib/mobile-accounts";
import { getSupabaseAdmin } from "@/lib/supabase/server";

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
