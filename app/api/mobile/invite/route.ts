import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { personalInviteURL } from "@/lib/invites";
import { getMobileParticipant, unauthorized } from "@/lib/mobile";

/** The participant's own Share-the-journey link, and how often it's been opened. */
export async function GET(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  return NextResponse.json({ url: await personalInviteURL(participant), opens: participant.invite_opens ?? 0 });
}
