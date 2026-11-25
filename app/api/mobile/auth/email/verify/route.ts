import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { badRequest, participantPayload, readJson, suspended } from "@/lib/mobile";
import { accountKey, canonicalEmail, consumeSignInCode, ensureParticipant } from "@/lib/mobile-accounts";
import { createParticipantSessionToken } from "@/lib/participant-auth";

/** Exchanges an emailed code for a session token, creating the participant if needed. */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const email = canonicalEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) return badRequest("Enter the six-digit code from your email.");

  const key = accountKey("email", email);
  const rejected = await consumeSignInCode(key, code);
  if (rejected) return rejected;

  const participant = await ensureParticipant(key);
  if (!participant) {
    return NextResponse.json({ error: "Sign-in is unavailable right now. Please try again." }, { status: 500 });
  }
  if (participant.community_status === "suspended") return suspended();
  return NextResponse.json({ token: await createParticipantSessionToken(key), participant: participantPayload(participant) });
}
