import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { deleteOwnPost } from "@/lib/community";
import { getMobileParticipant, unauthorized } from "@/lib/mobile";

/** Takes back something the participant shared. */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/mobile/together/posts/[id]">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const removed = await deleteOwnPost((await ctx.params).id, participant.phone_number);
  return removed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
