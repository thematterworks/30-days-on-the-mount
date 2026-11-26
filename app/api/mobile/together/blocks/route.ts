import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { blockAuthorOf, blockMember, blockedBy, unblock } from "@/lib/blocks";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";

/** The people the participant has blocked. */
export async function GET(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  return NextResponse.json({ blocked: await blockedBy(participant.phone_number) });
}

/** Blocks someone: { postId } (whoever wrote it) or { groupId, memberId }. */
export async function POST(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const body = await readJson(request);
  const ok =
    typeof body.postId === "string"
      ? await blockAuthorOf(participant.phone_number, body.postId)
      : typeof body.groupId === "string" && typeof body.memberId === "string"
        ? await blockMember(participant.phone_number, body.groupId, body.memberId)
        : false;
  if (!ok) return badRequest("They couldn't be blocked.");
  return NextResponse.json({ ok: true });
}

/** Unblocks: { memberId }. */
export async function DELETE(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const body = await readJson(request);
  if (typeof body.memberId !== "string") return badRequest("Who?");
  await unblock(participant.phone_number, body.memberId);
  return NextResponse.json({ ok: true });
}
