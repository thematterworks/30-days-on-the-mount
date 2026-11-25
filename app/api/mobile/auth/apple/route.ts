import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { badRequest, participantPayload, readJson, suspended } from "@/lib/mobile";
import { accountKey, ensureParticipant, verifyAppleIdentityToken } from "@/lib/mobile-accounts";
import { createParticipantSessionToken } from "@/lib/participant-auth";

/**
 * Sign in with Apple: exchanges Apple's identity token for a session. The
 * first name comes from the app (Apple only shares it on the first sign-in,
 * and only to the app), and only fills an empty name.
 */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (typeof body.identityToken !== "string") return badRequest("Missing identityToken.");

  const identity = await verifyAppleIdentityToken(body.identityToken);
  if (!identity) return NextResponse.json({ error: "Apple couldn't confirm that sign-in. Try again." }, { status: 401 });

  const key = accountKey("apple", identity.subject);
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : null;
  const participant = await ensureParticipant(key, firstName);
  if (!participant) {
    return NextResponse.json({ error: "Sign-in is unavailable right now. Please try again." }, { status: 500 });
  }
  if (participant.community_status === "suspended") return suspended();
  return NextResponse.json({ token: await createParticipantSessionToken(key), participant: participantPayload(participant) });
}
