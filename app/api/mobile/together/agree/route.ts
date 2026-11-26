import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileParticipant, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/** The participant agrees to the Community Guidelines, once, before first sharing. */
export async function POST(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  if (!participant.community_agreed_at) {
    await getSupabaseAdmin().from("users").update({ community_agreed_at: new Date().toISOString() }).eq("phone_number", participant.phone_number);
  }
  return NextResponse.json({ ok: true });
}
