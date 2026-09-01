import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentParticipant } from "@/lib/participant-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const MAX_REFLECTION_LENGTH = 1000;
const MAX_WALL_ITEMS = 100;

/** Shared gate: require a premium+active participant and a day they've reached. */
async function resolve(request: NextRequest, dayParam: string) {
  const participant = await getCurrentParticipant();
  if (!participant) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const dayNumber = Number(dayParam);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) {
    return { error: NextResponse.json({ error: "Invalid day" }, { status: 400 }) };
  }
  if (dayNumber > participant.current_day) {
    return { error: NextResponse.json({ error: "That day isn't open yet" }, { status: 403 }) };
  }
  return { participant, dayNumber };
}

/** Browse the approved reflections other participants have shared for this day. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/journey/community/[dayNumber]">) {
  const { dayNumber } = await ctx.params;
  const resolved = await resolve(request, dayNumber);
  if (resolved.error) return resolved.error;

  const { data, error } = await getSupabaseAdmin()
    .from("community_reflections")
    .select("id, day_number, display_name, reflection_text, created_at")
    .eq("day_number", resolved.dayNumber)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(MAX_WALL_ITEMS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // phone_number is deliberately never selected/returned — the wall shows
  // only display_name.
  return NextResponse.json({ reflections: data ?? [] });
}

/** Share a reflection to this day's wall. display_name is derived server-side
 *  from the authenticated participant — never trusted from the client. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/journey/community/[dayNumber]">) {
  const { dayNumber } = await ctx.params;
  const resolved = await resolve(request, dayNumber);
  if (resolved.error) return resolved.error;
  const { participant } = resolved;

  const body = (await request.json().catch(() => null)) as
    | { reflection_text?: string; anonymous?: boolean }
    | null;
  const text = body?.reflection_text?.trim();
  if (!text) {
    return NextResponse.json({ error: "reflection_text is required" }, { status: 400 });
  }
  if (text.length > MAX_REFLECTION_LENGTH) {
    return NextResponse.json({ error: "Reflection is too long" }, { status: 400 });
  }

  // First name only, or Anonymous. We don't collect surnames (frictionless
  // opt-in), and anonymity is the safe default whenever there's no name.
  const firstName = participant.first_name?.trim();
  const displayName = body?.anonymous || !firstName ? "Anonymous" : firstName.slice(0, 40);

  const { data, error } = await getSupabaseAdmin()
    .from("community_reflections")
    .insert({
      day_number: resolved.dayNumber,
      phone_number: participant.phone_number,
      display_name: displayName,
      reflection_text: text,
    })
    .select("id, day_number, display_name, reflection_text, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reflection: data }, { status: 201 });
}
