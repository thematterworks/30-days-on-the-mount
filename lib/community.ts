import "server-only";
import crypto from "node:crypto";
import { moderateCommunityPost } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CommunityPostStatus, UserRow } from "@/lib/supabase/types";

// Together: reflections shared with everyone on the same day, and posts in a
// walking-companion group. One table (community_posts) for both, so the
// admin moderation queue sees everything; a post with a group_id is only
// ever shown inside that group.

export const MAX_POST_LENGTH = 1000;
export const MAX_GROUP_SIZE = 12;
/** Reports that hide a post until an admin looks. */
const HIDE_AFTER_REPORTS = 2;

export type SharedPost = {
  id: string;
  dayNumber: number | null;
  displayName: string | null;
  text: string;
  createdAt: string;
  mine: boolean;
};

export type ShareOutcome = {
  /** "shared": visible now. "pending": waiting for a person. "held": not shown (distress or rejected). */
  outcome: "shared" | "pending" | "held";
  /** Offer the writer support privately — the screen saw signs of distress. */
  support: boolean;
  post?: SharedPost;
};

function toShared(row: { id: string; day_number: number | null; display_name: string | null; content: string; created_at: string; phone_number: string }, viewer: string): SharedPost {
  return {
    id: row.id,
    dayNumber: row.day_number,
    displayName: row.display_name,
    text: row.content,
    createdAt: row.created_at,
    mine: row.phone_number === viewer,
  };
}

/** The name a post carries: the participant's first name, or none. */
export function displayNameFor(participant: UserRow, anonymous: boolean, groupName?: string | null): string | null {
  if (anonymous) return null;
  const name = (groupName ?? participant.first_name)?.trim();
  return name ? name.slice(0, 40) : null;
}

/**
 * Screens and saves a post. Clearly safe posts are approved; uncertain ones
 * wait in the admin queue; distress is held ('flagged') and the writer is
 * offered support; harmful posts are held as 'deleted'.
 */
export async function sharePost(params: {
  participant: UserRow;
  dayNumber: number | null;
  text: string;
  displayName: string | null;
  groupId?: string;
}): Promise<ShareOutcome> {
  const { decision, note } = await moderateCommunityPost(params.text);
  const status: CommunityPostStatus =
    decision === "approve" ? "approved" : decision === "review" ? "pending" : decision === "distress" ? "flagged" : "deleted";

  const { data, error } = await getSupabaseAdmin()
    .from("community_posts")
    .insert({
      phone_number: params.participant.phone_number,
      day_number: params.dayNumber,
      content: params.text,
      display_name: params.displayName,
      group_id: params.groupId ?? null,
      status,
      moderated_at: new Date().toISOString(),
      moderated_by: "claude",
      moderation_note: `${decision}: ${note}`,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't save the post");

  return {
    outcome: status === "approved" ? "shared" : status === "pending" ? "pending" : "held",
    support: decision === "distress",
    post: status === "approved" ? toShared(data, params.participant.phone_number) : undefined,
  };
}

/** Approved reflections shared with everyone for one day, newest first. */
export async function dayReflections(dayNumber: number, viewer: string, limit = 100): Promise<SharedPost[]> {
  const { data } = await getSupabaseAdmin()
    .from("community_posts")
    .select("id, day_number, display_name, content, created_at, phone_number")
    .eq("day_number", dayNumber)
    .is("group_id", null)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => toShared(row, viewer));
}

/** Approved posts in a group, oldest first, optionally for one day. */
export async function groupPosts(groupId: string, viewer: string, dayNumber?: number): Promise<SharedPost[]> {
  let query = getSupabaseAdmin()
    .from("community_posts")
    .select("id, day_number, display_name, content, created_at, phone_number")
    .eq("group_id", groupId)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(300);
  if (dayNumber) query = query.eq("day_number", dayNumber);
  const { data } = await query;
  return (data ?? []).map((row) => toShared(row, viewer));
}

/** Removes the participant's own post. */
export async function deleteOwnPost(postId: string, phone: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("community_posts")
    .update({ status: "deleted" })
    .eq("id", postId)
    .eq("phone_number", phone)
    .select("id");
  return Boolean(data?.length);
}

/** A report; enough of them hide the post until an admin decides. */
export async function reportPost(postId: string, phone: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("community_reports").insert({ post_id: postId, phone_number: phone });
  if (error) return; // already reported by this person
  const { count } = await supabase.from("community_reports").select("*", { count: "exact", head: true }).eq("post_id", postId);
  await supabase
    .from("community_posts")
    .update({ report_count: count ?? 1, ...((count ?? 0) >= HIDE_AFTER_REPORTS ? { status: "pending" as const } : {}) })
    .eq("id", postId);
}

// MARK: - Walking companions

export type WalkingGroup = {
  id: string;
  name: string;
  inviteCode: string;
  inviteURL: string;
  members: { name: string; isMe: boolean }[];
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.30daysonthemount.com";

/** Eight letters and digits, without look-alikes (0/O, 1/I/L). */
function newInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function createGroup(participant: UserRow, name: string, displayName: string | null): Promise<string> {
  const supabase = getSupabaseAdmin();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("walking_groups")
      .insert({ name: name.slice(0, 60), invite_code: newInviteCode(), created_by: participant.phone_number })
      .select("id")
      .single();
    if (data) {
      await supabase.from("walking_group_members").insert({ group_id: data.id, phone_number: participant.phone_number, display_name: displayName });
      return data.id;
    }
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  }
  throw new Error("Couldn't create the group");
}

export async function joinGroup(participant: UserRow, code: string, displayName: string | null): Promise<{ groupId?: string; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data: group } = await supabase.from("walking_groups").select("id").eq("invite_code", code.trim().toUpperCase()).maybeSingle();
  if (!group) return { error: "That invitation isn't valid. Check the code and try again." };
  const { count } = await supabase.from("walking_group_members").select("*", { count: "exact", head: true }).eq("group_id", group.id);
  const { data: existing } = await supabase
    .from("walking_group_members")
    .select("group_id")
    .eq("group_id", group.id)
    .eq("phone_number", participant.phone_number)
    .maybeSingle();
  if (!existing && (count ?? 0) >= MAX_GROUP_SIZE) return { error: "This group is full." };
  if (!existing) {
    await supabase.from("walking_group_members").insert({ group_id: group.id, phone_number: participant.phone_number, display_name: displayName });
  }
  return { groupId: group.id };
}

export async function leaveGroup(groupId: string, phone: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("walking_group_members").delete().eq("group_id", groupId).eq("phone_number", phone);
  // The last one out closes the group, and its posts with it.
  const { count } = await supabase.from("walking_group_members").select("*", { count: "exact", head: true }).eq("group_id", groupId);
  if ((count ?? 0) === 0) await supabase.from("walking_groups").delete().eq("id", groupId);
}

export async function isMember(groupId: string, phone: string): Promise<{ displayName: string | null } | null> {
  const { data } = await getSupabaseAdmin()
    .from("walking_group_members")
    .select("display_name")
    .eq("group_id", groupId)
    .eq("phone_number", phone)
    .maybeSingle();
  return data ? { displayName: data.display_name } : null;
}

export async function groupsFor(phone: string): Promise<WalkingGroup[]> {
  const supabase = getSupabaseAdmin();
  const { data: memberships } = await supabase.from("walking_group_members").select("group_id").eq("phone_number", phone);
  const ids = (memberships ?? []).map((row) => row.group_id);
  if (ids.length === 0) return [];
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("walking_groups").select("id, name, invite_code, created_at").in("id", ids).order("created_at"),
    supabase.from("walking_group_members").select("group_id, phone_number, display_name, joined_at").in("group_id", ids).order("joined_at"),
  ]);
  return (groups ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    inviteCode: group.invite_code,
    inviteURL: `${SITE}/journey/join/${group.invite_code}`,
    members: (members ?? [])
      .filter((member) => member.group_id === group.id)
      .map((member) => ({ name: member.display_name || "A friend", isMe: member.phone_number === phone })),
  }));
}
