import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { displayNameFor, groupsFor, joinGroup } from "@/lib/community";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";

/** Joins a friend's group by its invite code. */
export async function POST(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const body = await readJson(request);
  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) return badRequest("Enter the invitation code.");
  const result = await joinGroup(participant, code, displayNameFor(participant, body.anonymous === true));
  if (result.error) return badRequest(result.error);
  return NextResponse.json({ groupId: result.groupId, groups: await groupsFor(participant.phone_number) });
}
