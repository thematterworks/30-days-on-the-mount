import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { leaveGroup } from "@/lib/community";
import { getMobileParticipant, unauthorized } from "@/lib/mobile";

/** Leaves a group. */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/mobile/together/groups/[id]">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  await leaveGroup((await ctx.params).id, participant.phone_number);
  return NextResponse.json({ ok: true });
}
