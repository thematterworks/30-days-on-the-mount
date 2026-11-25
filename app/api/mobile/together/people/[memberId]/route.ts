import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { memberCard } from "@/lib/community";
import { badRequest, getMobileParticipant, unauthorized } from "@/lib/mobile";

/** Someone's member card, seen from a group the viewer shares with them (?group=ID). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/mobile/together/people/[memberId]">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const groupId = request.nextUrl.searchParams.get("group");
  if (!groupId) return badRequest("Which group?");
  const card = await memberCard(participant.phone_number, groupId, (await ctx.params).memberId);
  if (!card) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ member: card });
}
