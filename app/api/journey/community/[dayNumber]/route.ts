import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentParticipant } from "@/lib/participant-auth";
import { dayReflections, displayNameFor, sharePost } from "@/lib/community";

const MAX_REFLECTION_LENGTH = 1000;
const MAX_WALL_ITEMS = 100;

/** Shared gate: require a premium+active participant and a day they've reached. */
async function resolve(request: NextRequest, dayParam: string) {
  const participant = await getCurrentParticipant();
  if (!participant) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const dayNumber = Number(dayParam);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
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

  // The same screened wall the app shows (lib/community.ts). phone_number is
  // never returned — only the name the writer chose, or "Anonymous".
  const posts = await dayReflections(resolved.dayNumber, resolved.participant.phone_number, MAX_WALL_ITEMS);
  return NextResponse.json({
    reflections: posts.map((post) => ({
      id: post.id,
      day_number: post.dayNumber,
      display_name: post.displayName ?? "Anonymous",
      reflection_text: post.text,
      created_at: post.createdAt,
    })),
  });
}

/** Share a reflection to this day's wall, screened first. The name is
 *  derived server-side from the participant — never trusted from the client. */
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

  const outcome = await sharePost({
    participant,
    dayNumber: resolved.dayNumber,
    text,
    displayName: displayNameFor(participant, body?.anonymous === true),
  });
  const post = outcome.post;
  return NextResponse.json(
    {
      outcome: outcome.outcome,
      support: outcome.support,
      reflection: post
        ? { id: post.id, day_number: post.dayNumber, display_name: post.displayName ?? "Anonymous", reflection_text: post.text, created_at: post.createdAt }
        : null,
    },
    { status: 201 },
  );
}
