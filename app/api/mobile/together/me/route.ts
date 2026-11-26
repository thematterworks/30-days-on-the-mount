import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { moderateCommunityPost } from "@/lib/ai";
import { memberId } from "@/lib/community";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { clearNotice, standingOf } from "@/lib/standing";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const MAX_ABOUT = 140;

/** The participant in Community: their standing (and any notice for them), and their one line. */
export async function GET(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  return NextResponse.json({
    standing: standingOf(participant),
    about: participant.about ?? null,
    memberId: memberId(participant.phone_number),
    agreed: Boolean(participant.community_agreed_at),
  });
}

/** Sets "A word about me" — screened, like everything others will see. */
export async function PUT(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const body = await readJson(request);
  const about = typeof body.about === "string" ? body.about.trim().replace(/\s+/g, " ") : "";
  if (about.length > MAX_ABOUT) return badRequest(`Keep it to ${MAX_ABOUT} characters.`);
  if (about) {
    const { decision } = await moderateCommunityPost(about, { strangers: true });
    if (decision !== "approve") {
      return badRequest("That line can't be shown on your card. Keep it gentle, and leave out contact details and links.");
    }
  }
  await getSupabaseAdmin().from("users").update({ about: about || null }).eq("phone_number", participant.phone_number);
  return NextResponse.json({ about: about || null });
}

/** The notice has been read. */
export async function DELETE(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  await clearNotice(participant.phone_number);
  return NextResponse.json({ ok: true });
}
