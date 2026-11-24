import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { badRequest, getMobileParticipant, participantPayload, readJson, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  return NextResponse.json({ participant: participantPayload(participant) });
}

/** The few things a participant can change about themselves from the app. */
export async function PATCH(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const body = await readJson(request);
  const changes: { first_name?: string | null; preferred_delivery_hour?: number; timezone?: string } = {};

  if ("firstName" in body) {
    const name = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 60) : "";
    changes.first_name = name || null;
  }
  if ("preferredHour" in body) {
    const hour = body.preferredHour;
    if (typeof hour !== "number" || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      return badRequest("preferredHour must be a whole hour from 0 to 23.");
    }
    changes.preferred_delivery_hour = hour;
  }
  if ("timezone" in body) {
    const timezone = typeof body.timezone === "string" ? body.timezone : "";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      return badRequest("Unknown timezone.");
    }
    changes.timezone = timezone;
  }
  if (Object.keys(changes).length === 0) return NextResponse.json({ participant: participantPayload(participant) });

  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .update(changes)
    .eq("phone_number", participant.phone_number)
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  return NextResponse.json({ participant: participantPayload(data) });
}
