import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Guideline } from "@/lib/guidelines";
import type { UserRow } from "@/lib/supabase/types";

// Community standing: what happens when someone breaks the Community
// Guidelines (app/community-guidelines). Written out there in plain words;
// this is the same ladder in code.
//
//   1st strike within 90 days → a private warning
//   2nd strike within 90 days → 7 days without posting anywhere in Community
//   3rd strike within 90 days → removed from Community (their journey goes on)
//   Severe violations (threats, sexual content or advances, hate, sharing
//   someone's private information, exploiting anyone) skip the ladder:
//   removed from Community at once; the admin may suspend the account.
//
// Being in distress is never a strike. Strikes can be revoked by an admin,
// and anyone can appeal by email.

export const SUPPORT_EMAIL = "30daysonthemount@gmail.com";
const STRIKE_WINDOW_DAYS = 90;
const PAUSE_DAYS = 7;

export { GUIDELINES, isGuideline, type Guideline } from "@/lib/guidelines";
export type CommunityStatus = "active" | "paused" | "removed" | "suspended";

export type Standing = {
  status: CommunityStatus;
  pausedUntil: string | null;
  /** A message for the participant, shown once. */
  notice: string | null;
};

/** The participant's standing now — an elapsed pause has ended. */
export function standingOf(user: Pick<UserRow, "community_status" | "community_paused_until" | "community_notice">): Standing {
  const status = (user.community_status ?? "active") as CommunityStatus;
  if (status === "paused" && user.community_paused_until && new Date(user.community_paused_until) <= new Date()) {
    return { status: "active", pausedUntil: null, notice: user.community_notice };
  }
  return { status, pausedUntil: status === "paused" ? user.community_paused_until : null, notice: user.community_notice };
}

/** Why the participant can't post to Community right now, or null if they can. */
export function postingBlockedReason(user: UserRow): string | null {
  const standing = standingOf(user);
  switch (standing.status) {
    case "active":
      return null;
    case "paused": {
      const until = standing.pausedUntil ? new Date(standing.pausedUntil).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "soon";
      return `Posting in Community is paused until ${until}, after repeated breaks of the Community Guidelines. Your journey continues as usual.`;
    }
    case "removed":
      return `You've been removed from Community for breaking the Community Guidelines. Your journey continues as usual. To appeal, write to ${SUPPORT_EMAIL}.`;
    case "suspended":
      return `This account has been suspended. To appeal, write to ${SUPPORT_EMAIL}.`;
  }
}

async function log(phone: string | null, action: string, note: string | null, postId: string | null, actor: string) {
  await getSupabaseAdmin().from("moderation_actions").insert({ phone_number: phone, post_id: postId, action, note, actor });
}

/** Takes someone out of every group and out of matching. */
async function removeFromGroups(phone: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from("walking_match_requests").delete().eq("phone_number", phone);
  const { data: memberships } = await supabase.from("walking_group_members").select("group_id").eq("phone_number", phone);
  for (const { group_id } of memberships ?? []) {
    await supabase.from("walking_group_members").delete().eq("group_id", group_id).eq("phone_number", phone);
    const { count } = await supabase.from("walking_group_members").select("*", { count: "exact", head: true }).eq("group_id", group_id);
    if ((count ?? 0) === 0) await supabase.from("walking_groups").delete().eq("id", group_id);
  }
}

/**
 * Sets someone's standing directly — the admin's actions, and the ladder's
 * outcomes. Removal and suspension take them out of every group.
 */
export async function setStanding(
  phone: string,
  action: "warn" | "pause" | "remove" | "suspend" | "restore",
  options: { note?: string; actor?: string; postId?: string; notice?: string } = {},
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const actor = options.actor ?? "admin";
  const pausedUntil = new Date(Date.now() + PAUSE_DAYS * 24 * 3600 * 1000).toISOString();
  const notices = {
    warn: "A note about something you shared: it was removed because it broke the Community Guidelines. Please read them again before you post. Another break within 90 days pauses posting for a week.",
    pause: `Something you shared broke the Community Guidelines again, so posting in Community is paused for ${PAUSE_DAYS} days. Your journey continues as usual. A further break within 90 days removes you from Community.`,
    remove: `You've been removed from Community for breaking the Community Guidelines. Your journey continues as usual. To appeal, write to ${SUPPORT_EMAIL}.`,
    suspend: `This account has been suspended. To appeal, write to ${SUPPORT_EMAIL}.`,
    restore: "Your place in Community has been restored. Welcome back.",
  };
  const changes: Record<typeof action, Partial<Pick<UserRow, "community_status" | "community_paused_until">>> = {
    warn: {},
    pause: { community_status: "paused", community_paused_until: pausedUntil },
    remove: { community_status: "removed", community_paused_until: null },
    suspend: { community_status: "suspended", community_paused_until: null },
    restore: { community_status: "active", community_paused_until: null },
  };
  await supabase
    .from("users")
    .update({ ...changes[action], community_notice: options.notice ?? notices[action] })
    .eq("phone_number", phone);
  if (action === "remove" || action === "suspend") await removeFromGroups(phone);
  await log(phone, action, options.note ?? null, options.postId ?? null, actor);
}

/**
 * Records a break of the guidelines and applies the ladder. Returns what
 * happened, for the message the writer sees.
 */
export async function recordStrike(params: {
  phone: string;
  guideline: Guideline;
  postId?: string | null;
  note?: string;
  source: "screen" | "admin";
  severe?: boolean;
}): Promise<"warn" | "pause" | "remove"> {
  const supabase = getSupabaseAdmin();
  await supabase.from("community_strikes").insert({
    phone_number: params.phone,
    post_id: params.postId ?? null,
    guideline: params.guideline,
    note: params.note ?? null,
    source: params.source,
    severity: params.severe ? "severe" : "standard",
  });
  const since = new Date(Date.now() - STRIKE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("community_strikes")
    .select("*", { count: "exact", head: true })
    .eq("phone_number", params.phone)
    .is("revoked_at", null)
    .gte("created_at", since);
  const strikes = count ?? 1;
  const action = params.severe || strikes >= 3 ? "remove" : strikes === 2 ? "pause" : "warn";
  await setStanding(params.phone, action, { note: `${params.guideline}: ${params.note ?? ""}`.trim(), actor: params.source, postId: params.postId ?? undefined });
  return action;
}

/** An admin takes a strike back; standing returns to what the rest warrant. */
export async function revokeStrike(strikeId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("community_strikes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", strikeId)
    .select("phone_number")
    .maybeSingle();
  if (data) await log(data.phone_number, "revoke_strike", strikeId, null, "admin");
}

/** Clears the one-time notice once the participant has seen it. */
export async function clearNotice(phone: string): Promise<void> {
  await getSupabaseAdmin().from("users").update({ community_notice: null }).eq("phone_number", phone);
}
