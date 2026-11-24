import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const HEX_TOKEN = /^[0-9a-f]{32,200}$/i;

/**
 * Registers this phone for push. A token belongs to one device, so a new
 * sign-in on the same phone moves it to the new participant.
 */
export async function POST(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const body = await readJson(request);
  const apnsToken = typeof body.apnsToken === "string" ? body.apnsToken.toLowerCase() : "";
  const liveActivityToken = typeof body.liveActivityToken === "string" ? body.liveActivityToken.toLowerCase() : null;
  const environment = body.environment === "production" ? "production" : "development";
  if (!HEX_TOKEN.test(apnsToken) || (liveActivityToken && !HEX_TOKEN.test(liveActivityToken))) {
    return badRequest("Invalid push token.");
  }

  const { error } = await getSupabaseAdmin().from("devices").upsert({
    apns_token: apnsToken,
    phone_number: participant.phone_number,
    live_activity_token: liveActivityToken,
    environment,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: "Couldn't register this device." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Called on sign-out, so a shared phone stops receiving someone else's pushes. */
export async function DELETE(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const apnsToken = (await readJson(request)).apnsToken;
  if (typeof apnsToken !== "string" || !HEX_TOKEN.test(apnsToken)) return badRequest("Invalid push token.");

  await getSupabaseAdmin()
    .from("devices")
    .delete()
    .eq("apns_token", apnsToken.toLowerCase())
    .eq("phone_number", participant.phone_number);
  return NextResponse.json({ ok: true });
}
