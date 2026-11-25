import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MAX_POST_LENGTH, groupPosts, isMember, markRead, sharePost } from "@/lib/community";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PostMedia } from "@/lib/supabase/types";

/**
 * A group's conversation, members only: the latest messages, or just the
 * ones after ?since= while the thread is open. Reading it marks it read.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/mobile/together/groups/[id]/posts">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const groupId = (await ctx.params).id;
  if (!(await isMember(groupId, participant.phone_number))) return NextResponse.json({ error: "Not a member." }, { status: 403 });
  const since = request.nextUrl.searchParams.get("since");
  const posts = await groupPosts(groupId, participant.phone_number, since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : undefined);
  await markRead(groupId, participant.phone_number);
  return NextResponse.json({ posts });
}

/** Writes to the group, screened like everything shared — more strictly among strangers. */
export const maxDuration = 120;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/mobile/together/groups/[id]/posts">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const groupId = (await ctx.params).id;
  const membership = await isMember(groupId, participant.phone_number);
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  const body = await readJson(request);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const media = readMedia(body.media, groupId);
  if (!text && !media) return badRequest("Write something first.");
  if (text.length > MAX_POST_LENGTH) return badRequest("That's a little long — try breaking it up.");
  const day = typeof body.dayNumber === "number" && body.dayNumber >= 1 && body.dayNumber <= 31 ? body.dayNumber : participant.current_day;
  const { data: group } = await getSupabaseAdmin().from("walking_groups").select("kind").eq("id", groupId).maybeSingle();

  return NextResponse.json(
    await sharePost({ participant, dayNumber: day, text, displayName: membership.displayName, groupId, strangers: group?.kind === "matched", media }),
  );
}

/** A photo, video or recording this group's upload route handed out. */
function readMedia(value: unknown, groupId: string): PostMedia | undefined {
  if (!value || typeof value !== "object") return undefined;
  const media = value as Record<string, unknown>;
  const inGroup = (path: unknown): path is string => typeof path === "string" && path.startsWith(`${groupId}/`) && !path.includes("..");
  if ((media.kind !== "image" && media.kind !== "video" && media.kind !== "audio") || !inGroup(media.path)) return undefined;
  const number = (key: string) => (typeof media[key] === "number" && Number.isFinite(media[key]) ? (media[key] as number) : undefined);
  return {
    kind: media.kind,
    path: media.path,
    thumbPath: inGroup(media.thumbPath) ? media.thumbPath : undefined,
    framesPath: inGroup(media.framesPath) ? media.framesPath : undefined,
    duration: number("duration"),
    width: number("width"),
    height: number("height"),
  };
}
