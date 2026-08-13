import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendFreeformToChannel } from "@/lib/messaging";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/users/[phone]/send">) {
  const { phone } = await ctx.params;
  const phoneNumber = decodeURIComponent(phone);
  const body = (await request.json().catch(() => null)) as { message?: string } | null;

  if (!body?.message || !body.message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from("users")
    .select("phone_number, channel")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const result = await sendFreeformToChannel(user.channel, phoneNumber, body.message);

  await supabase.from("message_logs").insert({
    phone_number: phoneNumber,
    direction: "outbound",
    message_type: "freeform",
    message_body: body.message,
    provider_message_id: result.messageId,
    status: result.ok ? "sent" : "failed",
    channel: user.channel,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to send message" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
