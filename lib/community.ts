import "server-only";
import crypto from "node:crypto";
import { after } from "next/server";
import { moderateCommunityPost } from "@/lib/ai";
import { sendAppNotification } from "@/lib/apns";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CommunityPostStatus, UserRow } from "@/lib/supabase/types";

// Together: reflections shared with everyone on the same day, and posts in a
// walking-companion group. One table (community_posts) for both, so the
// admin moderation queue sees everything; a post with a group_id is only
// ever shown inside that group.

export const MAX_POST_LENGTH = 1000;
export const MAX_GROUP_SIZE = 12;
/** Groups of strangers stay small enough for everyone to be known. */
export const MAX_MATCHED_GROUP_SIZE = 6;
/** The least time between two "new in your group" notifications to one person. */
const NOTIFY_GAP_MINUTES = 20;
/** Harmful posts in matched groups, within a month, that end someone's matching. */
const BLOCK_AFTER_REJECTIONS = 2;
/** Reports that hide a post until an admin looks. */
const HIDE_AFTER_REPORTS = 2;

export type SharedPost = {
  id: string;
  dayNumber: number | null;
  displayName: string | null;
  text: string;
  createdAt: string;
  mine: boolean;
  /** Written by the companion itself — a welcome, or a nudge to a quiet group. */
  fromCompanion: boolean;
};

export type ShareOutcome = {
  /** "shared": visible now. "pending": waiting for a person. "held": not shown (distress or rejected). */
  outcome: "shared" | "pending" | "held";
  /** Offer the writer support privately — the screen saw signs of distress. */
  support: boolean;
  post?: SharedPost;
  /** Said to the writer when a post is held for a reason they should know. */
  notice?: string;
};

type PostFields = { id: string; day_number: number | null; display_name: string | null; content: string; created_at: string; phone_number: string | null };
const POST_FIELDS = "id, day_number, display_name, content, created_at, phone_number";

function toShared(row: PostFields, viewer: string): SharedPost {
  return {
    id: row.id,
    dayNumber: row.day_number,
    displayName: row.phone_number ? row.display_name : "Companion",
    text: row.content,
    createdAt: row.created_at,
    mine: row.phone_number === viewer,
    fromCompanion: row.phone_number === null,
  };
}

/** Phone numbers, emails, handles and links — never passed between strangers. */
const CONTACT_DETAILS = /(\+?\d[\d\s().-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)|((^|\s)@[a-z0-9_.]{3,})|(https?:\/\/|www\.)|\b(insta(gram)?|snap(chat)?|whats ?app|telegram|tiktok|facebook|discord)\b/i;

/** The name a post carries: the participant's first name, or none. */
export function displayNameFor(participant: UserRow, anonymous: boolean, groupName?: string | null): string | null {
  if (anonymous) return null;
  const name = (groupName ?? participant.first_name)?.trim();
  return name ? name.slice(0, 40) : null;
}

/**
 * Screens and saves a post. Clearly safe posts are approved; uncertain ones
 * wait in the admin queue; distress is held ('flagged') and the writer is
 * offered support; harmful posts are held as 'deleted'. In a group of
 * strangers, contact details are held too, and repeated harmful posts end
 * the writer's place in matched groups.
 */
export async function sharePost(params: {
  participant: UserRow;
  dayNumber: number | null;
  text: string;
  displayName: string | null;
  groupId?: string;
  strangers?: boolean;
}): Promise<ShareOutcome> {
  const supabase = getSupabaseAdmin();
  // Looks like contact details: held for a person to look at (a pattern can
  // be wrong, so it never counts against the writer).
  const looksLikeContact = Boolean(params.strangers) && CONTACT_DETAILS.test(params.text);
  const { decision, note } = looksLikeContact
    ? { decision: "review" as const, note: "contact details (pattern)" }
    : await moderateCommunityPost(params.text, { strangers: params.strangers });
  const status: CommunityPostStatus =
    decision === "approve" ? "approved" : decision === "review" ? "pending" : decision === "distress" ? "flagged" : "deleted";

  const { data, error } = await supabase
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

  const post = status === "approved" ? toShared(data, params.participant.phone_number) : undefined;
  if (post && params.groupId) {
    const groupId = params.groupId;
    await supabase.from("walking_groups").update({ last_activity_at: data.created_at }).eq("id", groupId);
    await markRead(groupId, params.participant.phone_number);
    after(() => notifyGroup(groupId, params.participant.phone_number, post));
  }

  let notice: string | undefined;
  if (looksLikeContact) {
    notice = "To keep everyone safe, contact details, handles and links aren't shared in matched groups. If this was something else, it will appear once it has been read.";
  } else if (decision === "reject" && params.strangers) {
    notice = note.includes("contact")
      ? "To keep everyone safe, contact details, handles and links aren't shared in matched groups."
      : "This wasn't shared. Matched groups are kept gentle and safe for everyone.";
    if (await blockIfRepeated(params.participant.phone_number)) {
      notice = "You've been removed from matched groups because of what was shared. Your journey and any groups with friends are unaffected.";
    }
  }

  return {
    outcome: status === "approved" ? "shared" : status === "pending" ? "pending" : "held",
    support: decision === "distress",
    post,
    notice,
  };
}

/** After repeated harmful posts in matched groups: out of them, and out of matching. */
async function blockIfRepeated(phone: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data: matched } = await supabase.from("walking_groups").select("id").eq("kind", "matched");
  const matchedIds = (matched ?? []).map((group) => group.id);
  if (matchedIds.length === 0) return false;
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("community_posts")
    .select("*", { count: "exact", head: true })
    .eq("phone_number", phone)
    .eq("status", "deleted")
    .eq("moderated_by", "claude")
    .in("group_id", matchedIds)
    .gte("created_at", monthAgo);
  if ((count ?? 0) < BLOCK_AFTER_REJECTIONS) return false;
  await supabase.from("users").update({ matching_blocked_at: new Date().toISOString() }).eq("phone_number", phone);
  await supabase.from("walking_match_requests").delete().eq("phone_number", phone);
  for (const groupId of matchedIds) {
    if (await isMember(groupId, phone)) await leaveGroup(groupId, phone);
  }
  return true;
}

/**
 * Tells the rest of the group someone wrote — unless they're reading it
 * already, or were told within the last few minutes.
 */
export async function notifyGroup(groupId: string, authorPhone: string | null, post: SharedPost): Promise<void> {
  const supabase = getSupabaseAdmin();
  const [{ data: group }, { data: members }] = await Promise.all([
    supabase.from("walking_groups").select("name").eq("id", groupId).maybeSingle(),
    supabase.from("walking_group_members").select("phone_number, last_read_at, last_notified_at").eq("group_id", groupId),
  ]);
  if (!group) return;
  const quietSince = Date.now() - NOTIFY_GAP_MINUTES * 60 * 1000;
  const name = post.fromCompanion ? "Companion" : post.displayName ?? "Someone";
  for (const member of members ?? []) {
    if (member.phone_number === authorPhone) continue;
    if (member.last_notified_at && new Date(member.last_notified_at).getTime() > quietSince) continue;
    // Read within the last minute: they have the group open.
    if (new Date(member.last_read_at).getTime() > Date.now() - 60 * 1000) continue;
    await supabase
      .from("walking_group_members")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("group_id", groupId)
      .eq("phone_number", member.phone_number);
    await sendAppNotification(member.phone_number, {
      title: group.name,
      body: `${name}: ${post.text.length > 140 ? `${post.text.slice(0, 137)}…` : post.text}`,
      link: `mount://group/${groupId}`,
      collapseId: `group-${groupId}`,
    });
  }
}

/** A message from the companion itself, into a group's thread. */
export async function postAsCompanion(groupId: string, text: string, dayNumber: number | null, notify = true): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("community_posts")
    .insert({
      phone_number: null,
      day_number: dayNumber,
      content: text,
      display_name: "Companion",
      group_id: groupId,
      status: "approved",
      moderated_at: new Date().toISOString(),
      moderated_by: "companion",
    })
    .select(POST_FIELDS)
    .single();
  if (data && notify) await notifyGroup(groupId, null, toShared(data, ""));
}

/** The participant has seen the group up to now. */
export async function markRead(groupId: string, phone: string): Promise<void> {
  await getSupabaseAdmin()
    .from("walking_group_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("phone_number", phone);
}

/** Approved reflections shared with everyone for one day, newest first. */
export async function dayReflections(dayNumber: number, viewer: string, limit = 100): Promise<SharedPost[]> {
  const { data } = await getSupabaseAdmin()
    .from("community_posts")
    .select(POST_FIELDS)
    .eq("day_number", dayNumber)
    .is("group_id", null)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => toShared(row, viewer));
}

/**
 * A group's conversation, oldest first: the latest 200 messages, or only
 * those after `since` (polling while the thread is open).
 */
export async function groupPosts(groupId: string, viewer: string, since?: string): Promise<SharedPost[]> {
  let query = getSupabaseAdmin()
    .from("community_posts")
    .select(POST_FIELDS)
    .eq("group_id", groupId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(200);
  if (since) query = query.gt("created_at", since);
  const { data } = await query;
  return (data ?? []).reverse().map((row) => toShared(row, viewer));
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
  /** "friends": started by a participant, joined by invitation. "matched": strangers the app brought together. */
  kind: "friends" | "matched";
  /** Friends' groups only — matched groups take no invitations. */
  inviteCode: string | null;
  inviteURL: string | null;
  members: { name: string; isMe: boolean; currentDay: number | null }[];
  unread: number;
  lastMessage: { name: string; text: string; createdAt: string } | null;
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
  const { data: group } = await supabase
    .from("walking_groups")
    .select("id")
    .eq("invite_code", code.trim().toUpperCase())
    .eq("kind", "friends")
    .maybeSingle();
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
  const { data: memberships } = await supabase.from("walking_group_members").select("group_id, last_read_at").eq("phone_number", phone);
  const ids = (memberships ?? []).map((row) => row.group_id);
  if (ids.length === 0) return [];
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("walking_groups").select("id, name, kind, invite_code, last_activity_at").in("id", ids).order("last_activity_at", { ascending: false }),
    supabase.from("walking_group_members").select("group_id, phone_number, display_name, joined_at").in("group_id", ids).order("joined_at"),
  ]);
  const phones = [...new Set((members ?? []).map((member) => member.phone_number))];
  const { data: users } = await supabase.from("users").select("phone_number, current_day").in("phone_number", phones);
  const dayOf = new Map((users ?? []).map((user) => [user.phone_number, user.current_day]));

  return Promise.all(
    (groups ?? []).map(async (group) => {
      const readAt = memberships?.find((row) => row.group_id === group.id)?.last_read_at ?? new Date(0).toISOString();
      const [{ data: latest }, { count }] = await Promise.all([
        supabase.from("community_posts").select(POST_FIELDS).eq("group_id", group.id).eq("status", "approved").order("created_at", { ascending: false }).limit(1),
        supabase
          .from("community_posts")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("status", "approved")
          .gt("created_at", readAt)
          .or(`phone_number.is.null,phone_number.neq."${phone}"`),
      ]);
      const last = latest?.[0] ? toShared(latest[0], phone) : null;
      const isFriends = group.kind !== "matched";
      return {
        id: group.id,
        name: group.name,
        kind: isFriends ? ("friends" as const) : ("matched" as const),
        inviteCode: isFriends ? group.invite_code : null,
        inviteURL: isFriends ? `${SITE}/journey/join/${group.invite_code}` : null,
        members: (members ?? [])
          .filter((member) => member.group_id === group.id)
          .map((member) => ({
            name: member.display_name || "A friend",
            isMe: member.phone_number === phone,
            currentDay: dayOf.get(member.phone_number) ?? null,
          })),
        unread: count ?? 0,
        lastMessage: last ? { name: last.mine ? "You" : last.displayName ?? "Someone", text: last.text, createdAt: last.createdAt } : null,
      };
    }),
  );
}
