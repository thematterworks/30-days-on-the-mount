import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MAX_POST_LENGTH, groupPosts, isMember, sharePost } from "@/lib/community";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";

/** A group's thread — every day, or one (?day=4). Members only. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/mobile/together/groups/[id]/posts">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const groupId = (await ctx.params).id;
  if (!(await isMember(groupId, participant.phone_number))) return NextResponse.json({ error: "Not a member." }, { status: 403 });
  const day = Number(request.nextUrl.searchParams.get("day"));
  return NextResponse.json({ posts: await groupPosts(groupId, participant.phone_number, Number.isInteger(day) && day > 0 ? day : undefined) });
}

/** Writes to the group, screened like everything shared. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/mobile/together/groups/[id]/posts">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const groupId = (await ctx.params).id;
  const membership = await isMember(groupId, participant.phone_number);
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  const body = await readJson(request);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return badRequest("Write something first.");
  if (text.length > MAX_POST_LENGTH) return badRequest("That's a little long — try breaking it up.");
  const day = typeof body.dayNumber === "number" && body.dayNumber >= 1 && body.dayNumber <= 31 ? body.dayNumber : participant.current_day;

  return NextResponse.json(
    await sharePost({ participant, dayNumber: day, text, displayName: membership.displayName, groupId }),
  );
}
