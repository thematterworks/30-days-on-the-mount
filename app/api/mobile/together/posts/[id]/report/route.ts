import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { reportPost } from "@/lib/community";
import { getMobileParticipant, unauthorized } from "@/lib/mobile";

/** Reports a post; enough reports hide it until an admin looks. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/mobile/together/posts/[id]/report">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  await reportPost((await ctx.params).id, participant.phone_number);
  return NextResponse.json({ ok: true });
}
