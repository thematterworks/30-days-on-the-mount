import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data ?? [] });
}

interface CreateBody {
  slug?: string;
  title?: string;
  content?: string;
  media_url?: string;
  status?: "draft" | "published";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as CreateBody | null;

  if (!body?.slug || !body.title || !body.content) {
    return NextResponse.json({ error: "slug, title, and content are required" }, { status: 400 });
  }

  const status = body.status === "published" ? "published" : "draft";

  const { data, error } = await getSupabaseAdmin()
    .from("blog_posts")
    .insert({
      slug: body.slug,
      title: body.title,
      content: body.content,
      media_url: body.media_url ?? null,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
