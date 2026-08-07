import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await getSupabaseAdmin().from("system_config").select("*").order("key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { key?: string; value?: string } | null;

  if (!body?.key || typeof body.value !== "string") {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("system_config")
    .update({ value: body.value })
    .eq("key", body.key)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Config key not found" }, { status: 404 });
  }

  return NextResponse.json({ config: data });
}
