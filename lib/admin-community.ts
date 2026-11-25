import "server-only";
import { MEDIA_BUCKET } from "@/lib/community";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CommunityPostRow, CommunityStrikeRow, ModerationActionRow, UserRow } from "@/lib/supabase/types";

// What the admin's Community page shows: every post with its context (group,
// author's standing, media), and the people whose standing isn't clean.

export type AdminPost = CommunityPostRow & {
  groupName: string | null;
  groupKind: "friends" | "matched" | null;
  author: { name: string | null; status: UserRow["community_status"]; strikes: number } | null;
  mediaURL: string | null;
  thumbURL: string | null;
};

export type AdminView = "held" | "reported" | "all" | "group";

export async function adminPosts(view: AdminView, options: { groupId?: string; search?: string } = {}): Promise<AdminPost[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(200);
  if (view === "held") query = query.in("status", ["pending", "flagged"]);
  if (view === "reported") query = query.gt("report_count", 0);
  if (view === "group" && options.groupId) query = query.eq("group_id", options.groupId);
  if (options.search) query = query.ilike("content", `%${options.search.replace(/[%_]/g, "")}%`);
  const { data: posts } = await query;
  const rows = posts ?? [];

  const groupIds = [...new Set(rows.map((row) => row.group_id).filter((id): id is string => Boolean(id)))];
  const phones = [...new Set(rows.map((row) => row.phone_number).filter((phone): phone is string => Boolean(phone)))];
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const [{ data: groups }, { data: users }, { data: strikes }] = await Promise.all([
    groupIds.length ? supabase.from("walking_groups").select("id, name, kind").in("id", groupIds) : Promise.resolve({ data: [] }),
    phones.length ? supabase.from("users").select("phone_number, first_name, community_status").in("phone_number", phones) : Promise.resolve({ data: [] }),
    phones.length
      ? supabase.from("community_strikes").select("phone_number").in("phone_number", phones).is("revoked_at", null).gte("created_at", since)
      : Promise.resolve({ data: [] }),
  ]);

  const paths = rows.flatMap((row) => (row.media ? [row.media.path, row.media.thumbPath].filter((path): path is string => Boolean(path)) : []));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 3600);
    for (const item of data ?? []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }

  return rows.map((row) => {
    const group = (groups ?? []).find((item) => item.id === row.group_id);
    const user = (users ?? []).find((item) => item.phone_number === row.phone_number);
    return {
      ...row,
      groupName: group?.name ?? null,
      groupKind: (group?.kind as AdminPost["groupKind"]) ?? null,
      author: user
        ? {
            name: user.first_name,
            status: user.community_status,
            strikes: (strikes ?? []).filter((strike) => strike.phone_number === row.phone_number).length,
          }
        : null,
      mediaURL: row.media ? signed.get(row.media.path) ?? null : null,
      thumbURL: row.media?.thumbPath ? signed.get(row.media.thumbPath) ?? null : null,
    };
  });
}

export type AdminPerson = {
  phone: string;
  name: string | null;
  status: UserRow["community_status"];
  pausedUntil: string | null;
  strikes: CommunityStrikeRow[];
  actions: ModerationActionRow[];
};

/** Everyone with a strike, or whose standing isn't active. */
export async function adminPeople(): Promise<AdminPerson[]> {
  const supabase = getSupabaseAdmin();
  const [{ data: strikes }, { data: flagged }] = await Promise.all([
    supabase.from("community_strikes").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("users").select("phone_number").neq("community_status", "active"),
  ]);
  const phones = [...new Set([...(strikes ?? []).map((strike) => strike.phone_number), ...(flagged ?? []).map((user) => user.phone_number)])];
  if (phones.length === 0) return [];
  const [{ data: users }, { data: actions }] = await Promise.all([
    supabase.from("users").select("phone_number, first_name, community_status, community_paused_until").in("phone_number", phones),
    supabase.from("moderation_actions").select("*").in("phone_number", phones).order("created_at", { ascending: false }).limit(500),
  ]);
  return (users ?? []).map((user) => ({
    phone: user.phone_number,
    name: user.first_name,
    status: user.community_status,
    pausedUntil: user.community_paused_until,
    strikes: (strikes ?? []).filter((strike) => strike.phone_number === user.phone_number),
    actions: (actions ?? []).filter((action) => action.phone_number === user.phone_number),
  }));
}
