import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isGuideline, recordStrike } from "@/lib/standing";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CommunityPostStatus } from "@/lib/supabase/types";

/**
 * An admin's decision on a post:
 *   approve — show it (and clear its reports)
 *   remove  — hide it, no strike (off-topic, a mistake, the writer's privacy)
 *   strike  — hide it and give the writer a strike for `guideline`
 *             (`severe` skips to removal from Community)
 *   flag    — keep it held as distress, for follow-up
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/community/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    action?: "approve" | "remove" | "strike" | "flag";
    guideline?: string;
    severe?: boolean;
    note?: string;
  } | null;
  const action = body?.action;
  if (!action || !["approve", "remove", "strike", "flag"].includes(action)) {
    return NextResponse.json({ error: "Choose an action." }, { status: 400 });
  }
  if (action === "strike" && !isGuideline(body?.guideline)) {
    return NextResponse.json({ error: "Choose the guideline it breaks." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const status: CommunityPostStatus = action === "approve" ? "approved" : action === "flag" ? "flagged" : "deleted";
  const { data: post, error } = await supabase
    .from("community_posts")
    .update({
      status,
      moderated_at: new Date().toISOString(),
      moderated_by: "admin",
      ...(action === "approve" ? { report_count: 0 } : {}),
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  let outcome: string | null = null;
  if (action === "strike" && post.phone_number && isGuideline(body?.guideline)) {
    outcome = await recordStrike({
      phone: post.phone_number,
      guideline: body.guideline,
      postId: post.id,
      note: body.note,
      source: "admin",
      severe: body.severe === true,
    });
  }
  await supabase.from("moderation_actions").insert({ phone_number: post.phone_number, post_id: post.id, action: `post:${action}`, note: body?.note ?? null });
  return NextResponse.json({ post, outcome });
}
