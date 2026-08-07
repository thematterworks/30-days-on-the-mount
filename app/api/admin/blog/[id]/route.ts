import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { BlogPostRow } from "@/lib/supabase/types";

interface UpdateBody {
  title?: string;
  content?: string;
  media_url?: string;
  status?: "draft" | "published";
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/blog/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as UpdateBody | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const update: Partial<BlogPostRow> = {};
  for (const field of ["title", "content", "media_url"] as const) {
    if (typeof body[field] === "string") update[field] = body[field];
  }
  if (body.status === "draft" || body.status === "published") {
    update.status = body.status;
    if (body.status === "published") update.published_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("blog_posts")
    .update(update)
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

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/blog/[id]">) {
  const { id } = await ctx.params;

  const { error } = await getSupabaseAdmin().from("blog_posts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
