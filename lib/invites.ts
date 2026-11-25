import "server-only";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";

// Share the journey: each participant's own invitation link. It opens
// app/i/[code] — a welcome-style page that carries their first name and the
// day they're on, and never anything else about them.

export const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.30daysonthemount.com";

/** Seven letters and digits, without look-alikes. */
function newCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(7), (byte) => alphabet[byte % alphabet.length]).join("");
}

/** The participant's invitation link, made the first time it's asked for. */
export async function personalInviteURL(participant: UserRow): Promise<string> {
  if (participant.invite_code) return `${SITE}/i/${participant.invite_code}`;
  const supabase = getSupabaseAdmin();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = newCode();
    const { data } = await supabase
      .from("users")
      .update({ invite_code: code })
      .eq("phone_number", participant.phone_number)
      .is("invite_code", null)
      .select("invite_code")
      .maybeSingle();
    if (data?.invite_code) return `${SITE}/i/${data.invite_code}`;
    // Someone else's code, or already set by a parallel request: read it back.
    const { data: current } = await supabase.from("users").select("invite_code").eq("phone_number", participant.phone_number).maybeSingle();
    if (current?.invite_code) return `${SITE}/i/${current.invite_code}`;
  }
  return SITE;
}

export type Inviter = { firstName: string | null; currentDay: number };

/** Who sent an invitation — first name and day only. */
export async function inviterFor(code: string): Promise<Inviter | null> {
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  if (!clean) return null;
  const { data } = await getSupabaseAdmin().from("users").select("first_name, current_day").eq("invite_code", clean).maybeSingle();
  return data ? { firstName: data.first_name?.trim() || null, currentDay: data.current_day } : null;
}

/** Counts an opening of someone's link. */
export async function recordInviteOpen(code: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const { data } = await supabase.from("users").select("invite_opens").eq("invite_code", clean).maybeSingle();
  if (data) await supabase.from("users").update({ invite_opens: data.invite_opens + 1 }).eq("invite_code", clean);
}

export type GroupInvitation = { name: string; members: string[] };

/** A walking group's invitation: its name and its members' first names. */
export async function groupInvitation(code: string): Promise<GroupInvitation | null> {
  const supabase = getSupabaseAdmin();
  const { data: group } = await supabase.from("walking_groups").select("id, name").eq("invite_code", code).eq("kind", "friends").maybeSingle();
  if (!group) return null;
  const { data: members } = await supabase.from("walking_group_members").select("display_name").eq("group_id", group.id).order("joined_at");
  return { name: group.name, members: (members ?? []).map((member) => member.display_name?.trim()).filter((name): name is string => Boolean(name)) };
}
