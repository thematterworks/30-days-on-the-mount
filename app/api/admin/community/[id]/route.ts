import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CommunityPostStatus } from "@/lib/supabase/types";

const VALID_STATUSES: CommunityPostStatus[] = ["pending", "approved", "flagged", "deleted"];

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/community/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { status?: CommunityPostStatus } | null;

  if (!body?.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("community_posts")
    .update({
      status: body.status,
      moderated_at: new Date().toISOString(),
      moderated_by: "admin",
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ post: data });
}
