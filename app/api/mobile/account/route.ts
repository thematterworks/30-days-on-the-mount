import { NextResponse } from "next/server";
import { deleteAvatar } from "@/lib/avatar";
import { MEDIA_BUCKET } from "@/lib/community";
import type { NextRequest } from "next/server";
import { getMobileParticipant, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Deletes the participant and everything tied to them. App Store guideline
 * 5.1.1(v) requires account deletion in-app. Every participant table
 * references users(phone_number) with ON DELETE CASCADE, so one delete clears
 * messages, magic links, reflections and devices.
 */
export async function DELETE(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const supabase = getSupabaseAdmin();
  await supabase.from("sign_in_codes").delete().eq("phone_number", participant.phone_number);
  // Storage isn't covered by the cascade: the profile photo, and every
  // photo, video and recording they shared in a group.
  await deleteAvatar(participant.phone_number);
  const { data: shared } = await supabase.from("community_posts").select("media").eq("phone_number", participant.phone_number).not("media", "is", null);
  const paths = (shared ?? []).flatMap((post) => (post.media ? [post.media.path, post.media.thumbPath, post.media.framesPath] : [])).filter((path): path is string => Boolean(path));
  if (paths.length) await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  const { error } = await supabase.from("users").delete().eq("phone_number", participant.phone_number);
  if (error) {
    console.error("Account deletion failed", error);
    return NextResponse.json({ error: "Couldn't delete the account. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
