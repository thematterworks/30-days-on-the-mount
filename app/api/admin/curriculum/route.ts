import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from("curriculum_days")
    .select("*")
    .order("day_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ days: data ?? [] });
}
