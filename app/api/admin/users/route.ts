import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserStatus } from "@/lib/supabase/types";

const VALID_STATUSES: UserStatus[] = ["active", "paused", "completed", "opted_out"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const day = searchParams.get("day");
  const search = searchParams.get("search");

  let query = getSupabaseAdmin().from("users").select("*").order("last_interaction_at", { ascending: false });

  if (status && VALID_STATUSES.includes(status as UserStatus)) {
    query = query.eq("status", status as UserStatus);
  }
  if (day !== null && day !== "" && !Number.isNaN(Number(day))) {
    query = query.eq("current_day", Number(day));
  }
  if (search) {
    query = query.ilike("phone_number", `%${search}%`);
  }

  const { data, error } = await query.limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}
