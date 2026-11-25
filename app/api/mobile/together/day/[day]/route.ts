import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MAX_POST_LENGTH, dayReflections, displayNameFor, sharePost } from "@/lib/community";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";

function dayFrom(raw: string, current: number): number | null {
  const day = Number(raw);
  return Number.isInteger(day) && day >= 1 && day <= 31 && day <= Math.max(current, 1) ? day : null;
}

/** What others walking this day chose to share. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/mobile/together/day/[day]">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const day = dayFrom((await ctx.params).day, participant.current_day);
  if (!day) return badRequest("That day isn't open yet.");
  return NextResponse.json({ posts: await dayReflections(day, participant.phone_number) });
}

/** Shares a reflection with everyone on this day — screened first. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/mobile/together/day/[day]">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const day = dayFrom((await ctx.params).day, participant.current_day);
  if (!day) return badRequest("That day isn't open yet.");

  const body = await readJson(request);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return badRequest("Write something to share.");
  if (text.length > MAX_POST_LENGTH) return badRequest("That's a little long to share — try trimming it.");

  const outcome = await sharePost({
    participant,
    dayNumber: day,
    text,
    displayName: displayNameFor(participant, body.anonymous === true),
  });
  return NextResponse.json(outcome);
}
