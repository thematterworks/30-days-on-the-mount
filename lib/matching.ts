import "server-only";
import crypto from "node:crypto";
import { sendAppNotification } from "@/lib/apns";
import { blockedPairs } from "@/lib/blocks";
import { MAX_MATCHED_GROUP_SIZE, isMember, postAsCompanion } from "@/lib/community";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";

// Matching strangers into walking groups (Profile → Together → "Find walking
// companions"). Someone who opts in waits in walking_match_requests until
// enough people are within a few days of them on the journey; then a small
// 'matched' group is formed and everyone is told. First names only, no
// invitations, no private messages, and the stricter screen for strangers
// (lib/community.ts sharePost with strangers: true).
//
// tendGroups() runs hourly from the scheduled-messaging workflow: it forms
// groups for whoever is waiting, nudges quiet groups, and folds groups that
// have dwindled into another one nearby.

/** Days apart two people can be and still walk together. */
const DAY_WINDOW = 2;
/** After waiting this long, a wider window and smaller groups are fine. */
const PATIENCE_HOURS = 48;
const WIDE_DAY_WINDOW = 4;
/** The smallest group formed — and, after PATIENCE_HOURS, a pair. */
const MIN_TO_FORM = 3;
/** Quiet this long, a group hears from the companion. */
const QUIET_HOURS = 48;
/** A matched group this small, after its first days, is folded into another. */
const MERGE_AT_OR_BELOW = 2;
/** Matched groups take new people for their first three weeks. */
const OPEN_FOR_DAYS = 21;

/** Places from the Sermon on the Mount and its hillside. */
const GROUP_NAMES = [
  "Salt & Light", "City on a Hill", "Lamp on a Stand", "Lilies of the Field", "Birds of the Air",
  "The Narrow Gate", "House on the Rock", "The Lakeshore", "Olive Grove", "The Hillside",
  "Morning Path", "Daily Bread", "Treasure in Heaven", "The Second Mile", "Good Soil",
];

export type MatchStatus =
  | { state: "none"; termsAccepted: boolean }
  | { state: "waiting"; since: string }
  | { state: "blocked" };

export async function matchStatus(participant: UserRow): Promise<MatchStatus> {
  if (participant.matching_blocked_at || participant.community_status === "removed") return { state: "blocked" };
  const { data } = await getSupabaseAdmin()
    .from("walking_match_requests")
    .select("requested_at")
    .eq("phone_number", participant.phone_number)
    .maybeSingle();
  return data ? { state: "waiting", since: data.requested_at } : { state: "none", termsAccepted: Boolean(participant.walking_terms_accepted_at) };
}

/** Puts the participant in line, and matches straight away if there are people to match with. */
export async function requestMatch(participant: UserRow, displayName: string): Promise<{ groupId?: string }> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("walking_match_requests")
    .upsert({ phone_number: participant.phone_number, display_name: displayName.slice(0, 40) }, { onConflict: "phone_number" });
  await formGroups();
  const { data: still } = await supabase.from("walking_match_requests").select("phone_number").eq("phone_number", participant.phone_number).maybeSingle();
  if (still) return {};
  const { data: latest } = await supabase
    .from("walking_group_members")
    .select("group_id, joined_at")
    .eq("phone_number", participant.phone_number)
    .order("joined_at", { ascending: false })
    .limit(1);
  return { groupId: latest?.[0]?.group_id };
}

export async function cancelMatch(phone: string): Promise<void> {
  await getSupabaseAdmin().from("walking_match_requests").delete().eq("phone_number", phone);
}

type Waiting = { phone: string; name: string | null; day: number; waitedHours: number };
type OpenGroup = { id: string; name: string; size: number; day: number; phones: string[] };

async function openMatchedGroups(): Promise<OpenGroup[]> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - OPEN_FOR_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: groups } = await supabase.from("walking_groups").select("id, name").eq("kind", "matched").gte("created_at", since);
  if (!groups?.length) return [];
  const { data: members } = await supabase.from("walking_group_members").select("group_id, phone_number").in("group_id", groups.map((group) => group.id));
  const phones = [...new Set((members ?? []).map((member) => member.phone_number))];
  const { data: users } = phones.length
    ? await supabase.from("users").select("phone_number, current_day").in("phone_number", phones)
    : { data: [] };
  const dayOf = new Map((users ?? []).map((user) => [user.phone_number, user.current_day]));
  return groups.map((group) => {
    const groupPhones = (members ?? []).filter((member) => member.group_id === group.id).map((member) => member.phone_number);
    const days = groupPhones.map((phone) => dayOf.get(phone) ?? 1).sort((a, b) => a - b);
    return { id: group.id, name: group.name, size: groupPhones.length, day: days[Math.floor(days.length / 2)] ?? 1, phones: groupPhones };
  });
}

/**
 * Brings waiting people together: first into an open matched group on
 * nearby days, then into new groups of three to six. Anyone who has waited
 * two days gets a wider window, and can be paired with one other person.
 */
export async function formGroups(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data: requests } = await supabase.from("walking_match_requests").select("*").order("requested_at");
  if (!requests?.length) return 0;
  const { data: users } = await supabase
    .from("users")
    .select("phone_number, current_day, matching_blocked_at, community_status")
    .in("phone_number", requests.map((request) => request.phone_number));
  const userOf = new Map((users ?? []).map((user) => [user.phone_number, user]));

  let waiting: Waiting[] = requests
    .filter((request) => {
      const user = userOf.get(request.phone_number);
      return user && !user.matching_blocked_at && user.community_status !== "removed" && user.community_status !== "suspended";
    })
    .map((request) => ({
      phone: request.phone_number,
      name: request.display_name,
      day: userOf.get(request.phone_number)?.current_day ?? 1,
      waitedHours: (Date.now() - new Date(request.requested_at).getTime()) / 3600_000,
    }));
  const windowFor = (person: Waiting) => (person.waitedHours >= PATIENCE_HOURS ? WIDE_DAY_WINDOW : DAY_WINDOW);
  let placed = 0;

  // Never together: anyone who has blocked another.
  const open = await openMatchedGroups();
  const pairs = await blockedPairs([...new Set([...waiting.map((person) => person.phone), ...open.flatMap((group) => group.phones)])]);
  const clashes = (phone: string, others: string[]) => others.some((other) => pairs.has(`${phone}|${other}`));

  // Into a group that already exists — the one nearest in days.
  for (const person of [...waiting]) {
    const fits = open
      .filter((group) => group.size < MAX_MATCHED_GROUP_SIZE && group.size > 0 && !group.phones.includes(person.phone) && !clashes(person.phone, group.phones))
      .filter((group) => Math.abs(group.day - person.day) <= windowFor(person))
      .sort((a, b) => Math.abs(a.day - person.day) - Math.abs(b.day - person.day) || a.size - b.size);
    const group = fits[0];
    if (!group) continue;
    await addMember(group.id, person);
    group.size += 1;
    group.phones.push(person.phone);
    waiting = waiting.filter((other) => other.phone !== person.phone);
    placed += 1;
    await postAsCompanion(group.id, `${person.name ?? "Someone new"} has joined you, walking Day ${person.day}. Make them welcome.`, person.day);
    await tellMatched(person.phone, group.id, group.name);
  }

  // New groups, around whoever has waited longest.
  const usedNames = new Set(open.map((group) => group.name));
  while (waiting.length > 0) {
    const anchor = waiting[0];
    const nearby: Waiting[] = [];
    for (const other of waiting
      .filter((candidate) => Math.abs(candidate.day - anchor.day) <= windowFor(anchor))
      .sort((a, b) => Math.abs(a.day - anchor.day) - Math.abs(b.day - anchor.day))) {
      if (nearby.length >= MAX_MATCHED_GROUP_SIZE) break;
      if (!clashes(other.phone, nearby.map((person) => person.phone))) nearby.push(other);
    }
    const enough = nearby.length >= MIN_TO_FORM || (nearby.length >= 2 && anchor.waitedHours >= PATIENCE_HOURS);
    if (!enough) {
      waiting = waiting.slice(1);
      continue;
    }
    const name = GROUP_NAMES.find((candidate) => !usedNames.has(candidate)) ?? `Walking Group ${crypto.randomInt(100, 999)}`;
    usedNames.add(name);
    const { data: group, error } = await supabase
      .from("walking_groups")
      .insert({ name, kind: "matched", invite_code: `M${crypto.randomBytes(6).toString("hex").toUpperCase()}` })
      .select("id")
      .single();
    if (error || !group) throw new Error(error?.message ?? "Couldn't form a group");
    for (const person of nearby) await addMember(group.id, person);
    const days = nearby.map((person) => person.day).sort((a, b) => a - b);
    await postAsCompanion(
      group.id,
      `Welcome. You're ${nearby.length} people walking the mount within a few days of each other${days[0] === days[days.length - 1] ? `, all on Day ${days[0]}` : ` (Days ${days[0]}–${days[days.length - 1]})`}. Say hello, and share what brought you here.`,
      days[0],
      false,
    );
    for (const person of nearby) await tellMatched(person.phone, group.id, name);
    const joined = new Set(nearby.map((person) => person.phone));
    waiting = waiting.filter((other) => !joined.has(other.phone));
    placed += nearby.length;
  }
  return placed;
}

async function addMember(groupId: string, person: Waiting): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!(await isMember(groupId, person.phone))) {
    await supabase.from("walking_group_members").insert({ group_id: groupId, phone_number: person.phone, display_name: person.name });
  }
  await supabase.from("walking_match_requests").delete().eq("phone_number", person.phone);
}

async function tellMatched(phone: string, groupId: string, name: string): Promise<void> {
  await sendAppNotification(phone, {
    title: "You have walking companions",
    body: `You've been matched with others walking nearby days, in "${name}". Come and say hello.`,
    link: `mount://group/${groupId}`,
    collapseId: `matched-${groupId}`,
  });
}

/** A quiet group hears from the companion, with a question from the day most of them are on. */
async function nudgeQuietGroups(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const quietSince = new Date(Date.now() - QUIET_HOURS * 3600 * 1000).toISOString();
  const { data: groups } = await supabase.from("walking_groups").select("id, last_nudged_at").lt("last_activity_at", quietSince);
  const due = (groups ?? []).filter((group) => !group.last_nudged_at || group.last_nudged_at < quietSince);
  if (due.length === 0) return 0;

  const { data: days } = await supabase.from("curriculum_days").select("day_number, evening_prompt_text, title");
  const dayByNumber = new Map((days ?? []).map((day) => [day.day_number, day]));
  let nudged = 0;
  for (const group of due) {
    const { data: members } = await supabase.from("walking_group_members").select("phone_number").eq("group_id", group.id);
    if (!members || members.length < 2) continue;
    const { data: users } = await supabase
      .from("users")
      .select("current_day")
      .in("phone_number", members.map((member) => member.phone_number));
    const sorted = (users ?? []).map((user) => user.current_day).sort((a, b) => a - b);
    const day = sorted[Math.floor(sorted.length / 2)];
    // Everyone's finished: the group rests.
    if (!day || day > 31) continue;
    const question = dayByNumber.get(day)?.evening_prompt_text?.trim();
    const text = question
      ? `It's been quiet on the mount. Most of you are around Day ${day}. ${question} Even a line helps the others keep walking.`
      : `It's been quiet on the mount. How is the walk going for you this week? Even a line helps the others keep walking.`;
    await postAsCompanion(group.id, text, day);
    await supabase.from("walking_groups").update({ last_nudged_at: new Date().toISOString() }).eq("id", group.id);
    nudged += 1;
  }
  return nudged;
}

/**
 * A matched group down to one or two people, after its first days, joins
 * the nearest open group with room — members and conversation together.
 */
async function foldSmallGroups(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const settled = Date.now() - 3 * 24 * 3600 * 1000;
  const open = await openMatchedGroups();
  const { data: ages } = await supabase.from("walking_groups").select("id, created_at").in("id", open.map((group) => group.id));
  const createdAt = new Map((ages ?? []).map((group) => [group.id, new Date(group.created_at).getTime()]));
  let folded = 0;
  for (const small of open.filter((group) => group.size > 0 && group.size <= MERGE_AT_OR_BELOW && (createdAt.get(group.id) ?? 0) < settled)) {
    if (small.size === 0) continue;
    const target = open
      .filter((group) => group.id !== small.id && group.size > 0 && group.size + small.size <= MAX_MATCHED_GROUP_SIZE)
      .filter((group) => Math.abs(group.day - small.day) <= WIDE_DAY_WINDOW)
      .sort((a, b) => Math.abs(a.day - small.day) - Math.abs(b.day - small.day))[0];
    if (!target) continue;
    const { data: moving } = await supabase.from("walking_group_members").select("phone_number, display_name").eq("group_id", small.id);
    for (const member of moving ?? []) {
      await supabase.from("walking_group_members").insert({ group_id: target.id, phone_number: member.phone_number, display_name: member.display_name });
    }
    await supabase.from("community_posts").update({ group_id: target.id }).eq("group_id", small.id);
    await supabase.from("walking_groups").delete().eq("id", small.id);
    const names = (moving ?? []).map((member) => member.display_name ?? "a friend");
    await postAsCompanion(target.id, `${names.join(" and ")} ${names.length === 1 ? "has" : "have"} joined you from a smaller group. Welcome them in.`, target.day);
    for (const member of moving ?? []) await tellMatched(member.phone_number, target.id, target.name);
    target.size += small.size;
    small.size = 0;
    folded += 1;
  }
  return folded;
}

/**
 * The hourly pass. Matching every hour, so no one waits long; nudges and
 * folding once a day, at 17:00 UTC (late morning across the Americas).
 */
export async function tendGroups(now = new Date()): Promise<{ placed: number; nudged: number; folded: number }> {
  const placed = await formGroups();
  if (now.getUTCHours() !== 17) return { placed, nudged: 0, folded: 0 };
  const folded = await foldSmallGroups();
  const nudged = await nudgeQuietGroups();
  return { placed, nudged, folded };
}
