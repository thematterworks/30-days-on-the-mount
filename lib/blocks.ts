import "server-only";
import { memberId } from "@/lib/community";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Blocking (App Review 1.2). A block works both ways: neither person sees
// the other's posts, on the day's wall or in a group, and the matching
// never puts them in the same group. Only the blocker can undo it.

/** Everyone whose posts the viewer shouldn't see: those they blocked, and those who blocked them. */
export async function hiddenPhones(viewer: string): Promise<Set<string>> {
  if (!viewer) return new Set();
  const supabase = getSupabaseAdmin();
  const [{ data: mine }, { data: theirs }] = await Promise.all([
    supabase.from("community_blocks").select("blocked").eq("blocker", viewer),
    supabase.from("community_blocks").select("blocker").eq("blocked", viewer),
  ]);
  return new Set([...(mine ?? []).map((row) => row.blocked), ...(theirs ?? []).map((row) => row.blocker)]);
}

/** Pairs among `phones` where one has blocked the other, as "a|b" both ways. */
export async function blockedPairs(phones: string[]): Promise<Set<string>> {
  if (phones.length < 2) return new Set();
  const { data } = await getSupabaseAdmin().from("community_blocks").select("blocker, blocked").in("blocker", phones).in("blocked", phones);
  const pairs = new Set<string>();
  for (const row of data ?? []) {
    pairs.add(`${row.blocker}|${row.blocked}`);
    pairs.add(`${row.blocked}|${row.blocker}`);
  }
  return pairs;
}

async function block(viewer: string, phone: string, name: string | null): Promise<boolean> {
  if (phone === viewer) return false;
  const { error } = await getSupabaseAdmin()
    .from("community_blocks")
    .upsert({ blocker: viewer, blocked: phone, blocked_name: name }, { onConflict: "blocker,blocked" });
  return !error;
}

/** Blocks whoever wrote a post. */
export async function blockAuthorOf(viewer: string, postId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from("community_posts").select("phone_number, display_name").eq("id", postId).maybeSingle();
  if (!data?.phone_number) return false;
  return block(viewer, data.phone_number, data.display_name);
}

/** Blocks a member of a group the viewer shares. */
export async function blockMember(viewer: string, groupId: string, id: string): Promise<boolean> {
  const { data: members } = await getSupabaseAdmin().from("walking_group_members").select("phone_number, display_name").eq("group_id", groupId);
  if (!(members ?? []).some((row) => row.phone_number === viewer)) return false;
  const member = (members ?? []).find((row) => memberId(row.phone_number) === id);
  return member ? block(viewer, member.phone_number, member.display_name) : false;
}

export type BlockedPerson = { id: string; name: string; since: string };

export async function blockedBy(viewer: string): Promise<BlockedPerson[]> {
  const { data } = await getSupabaseAdmin()
    .from("community_blocks")
    .select("blocked, blocked_name, created_at")
    .eq("blocker", viewer)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({ id: memberId(row.blocked), name: row.blocked_name || "Someone on the journey", since: row.created_at }));
}

export async function unblock(viewer: string, id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("community_blocks").select("blocked").eq("blocker", viewer);
  const row = (data ?? []).find((item) => memberId(item.blocked) === id);
  if (row) await supabase.from("community_blocks").delete().eq("blocker", viewer).eq("blocked", row.blocked);
}
