import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { groupsFor } from "@/lib/community";
import { cancelMatch, matchStatus, requestMatch } from "@/lib/matching";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { postingBlockedReason, standingOf } from "@/lib/standing";

/** Whether the participant is waiting to be matched with walking companions. */
export async function GET(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  return NextResponse.json({ status: await matchStatus(participant) });
}

/**
 * Opts in to being matched with strangers. The first time, they confirm
 * they're 18 or older and agree to the guidelines; a first name is needed,
 * since matched groups show first names only.
 */
export async function POST(request: NextRequest) {
  let participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  if (standingOf(participant).status === "removed") {
    return NextResponse.json({ error: postingBlockedReason(participant) }, { status: 403 });
  }
  if (participant.matching_blocked_at) {
    return NextResponse.json({ error: "Matching isn't available on this account." }, { status: 403 });
  }

  const body = await readJson(request);
  const changes: { walking_terms_accepted_at?: string; first_name?: string } = {};
  if (!participant.walking_terms_accepted_at) {
    if (body.adult !== true || body.agreed !== true) return badRequest("Confirm you're 18 or older and agree to the guidelines.");
    changes.walking_terms_accepted_at = new Date().toISOString();
  }
  const offeredName = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 40) : "";
  if (!participant.first_name?.trim()) {
    if (!offeredName) return badRequest("Add your first name — matched groups show first names only.");
    changes.first_name = offeredName;
  }
  if (Object.keys(changes).length > 0) {
    const { data } = await getSupabaseAdmin().from("users").update(changes).eq("phone_number", participant.phone_number).select().single();
    if (data) participant = data;
  }

  try {
    const { groupId } = await requestMatch(participant, participant.first_name!.trim());
    return NextResponse.json({
      status: await matchStatus(participant),
      groupId: groupId ?? null,
      groups: await groupsFor(participant.phone_number),
    });
  } catch (error) {
    console.error("Matching failed", error);
    return NextResponse.json({ error: "Couldn't start matching. Try again." }, { status: 500 });
  }
}

/** Stops waiting. */
export async function DELETE(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  await cancelMatch(participant.phone_number);
  return NextResponse.json({ status: await matchStatus(participant) });
}
