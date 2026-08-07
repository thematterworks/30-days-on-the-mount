import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CommunityPostStatus } from "@/lib/supabase/types";

const VALID_STATUSES: CommunityPostStatus[] = ["pending", "approved", "flagged", "deleted"];

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");

  let query = getSupabaseAdmin().from("community_posts").select("*").order("created_at", { ascending: false });

  if (status && VALID_STATUSES.includes(status as CommunityPostStatus)) {
    query = query.eq("status", status as CommunityPostStatus);
  }

  const { data, error } = await query.limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data ?? [] });
}
