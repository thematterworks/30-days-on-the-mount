import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createGroup, displayNameFor, groupsFor } from "@/lib/community";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { postingBlockedReason, standingOf } from "@/lib/standing";

/** The participant's walking-companion groups. */
export async function GET(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  return NextResponse.json({ groups: await groupsFor(participant.phone_number) });
}

/** Starts a group; its invite link goes to friends. */
export async function POST(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  if (standingOf(participant).status === "removed") {
    return NextResponse.json({ error: postingBlockedReason(participant) }, { status: 403 });
  }
  const body = await readJson(request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return badRequest("Give your group a name.");
  try {
    await createGroup(participant, name, displayNameFor(participant, body.anonymous === true));
  } catch (error) {
    console.error("Creating a group failed", error);
    return NextResponse.json({ error: "Couldn't start the group. Try again." }, { status: 500 });
  }
  return NextResponse.json({ groups: await groupsFor(participant.phone_number) });
}
