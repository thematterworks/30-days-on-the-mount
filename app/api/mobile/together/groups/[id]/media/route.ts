import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MEDIA_BUCKET, isMember } from "@/lib/community";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { postingBlockedReason } from "@/lib/standing";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const TYPES = {
  image: { contentType: "image/jpeg", ext: "jpg" },
  video: { contentType: "video/mp4", ext: "mp4" },
  audio: { contentType: "audio/mp4", ext: "m4a" },
} as const;

/**
 * Where the app uploads a photo, video or voice message for the group —
 * straight to storage, by short-lived signed URLs, so large files never
 * pass through here. A video also uploads its poster frame and a sheet of
 * frames for the screen. The post that carries it is screened before
 * anyone else sees it.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/mobile/together/groups/[id]/media">) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();
  const blocked = postingBlockedReason(participant);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const groupId = (await ctx.params).id;
  if (!(await isMember(groupId, participant.phone_number))) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  const body = await readJson(request);
  const kind = body.kind;
  if (kind !== "image" && kind !== "video" && kind !== "audio") return badRequest("Choose a photo, video or voice message.");

  const storage = getSupabaseAdmin().storage.from(MEDIA_BUCKET);
  const base = `${groupId}/${crypto.randomUUID()}`;
  const sign = async (path: string) => {
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "no upload url");
    return data.signedUrl;
  };
  try {
    const path = `${base}.${TYPES[kind].ext}`;
    const upload = { path, uploadURL: await sign(path), contentType: TYPES[kind].contentType };
    if (kind !== "video") return NextResponse.json({ upload });
    const thumbPath = `${base}-poster.jpg`;
    const framesPath = `${base}-frames.jpg`;
    return NextResponse.json({
      upload,
      thumb: { path: thumbPath, uploadURL: await sign(thumbPath), contentType: "image/jpeg" },
      frames: { path: framesPath, uploadURL: await sign(framesPath), contentType: "image/jpeg" },
    });
  } catch (error) {
    console.error("Media upload URL failed", error);
    return NextResponse.json({ error: "It couldn't be uploaded just now." }, { status: 500 });
  }
}
