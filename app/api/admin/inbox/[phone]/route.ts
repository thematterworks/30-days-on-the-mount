import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(_request: Request, ctx: RouteContext<"/api/admin/inbox/[phone]">) {
  const { phone } = await ctx.params;
  const phoneNumber = decodeURIComponent(phone);

  const supabase = getSupabaseAdmin();

  const [{ data: user }, { data: messages, error }] = await Promise.all([
    supabase.from("users").select("*").eq("phone_number", phoneNumber).maybeSingle(),
    supabase
      .from("message_logs")
      .select("*")
      .eq("phone_number", phoneNumber)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user, messages: messages ?? [] });
}
