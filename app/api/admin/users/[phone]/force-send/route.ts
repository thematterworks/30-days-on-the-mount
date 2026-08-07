import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendTemplateMessage } from "@/lib/whatsapp";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/users/[phone]/force-send">) {
  const { phone } = await ctx.params;
  const phoneNumber = decodeURIComponent(phone);

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: curriculumDay } = await supabase
    .from("curriculum_days")
    .select("template_name")
    .eq("day_number", user.current_day)
    .maybeSingle();

  if (!curriculumDay) {
    return NextResponse.json({ error: `No curriculum entry for day ${user.current_day}` }, { status: 404 });
  }

  const result = await sendTemplateMessage(phoneNumber, curriculumDay.template_name);

  await supabase.from("message_logs").insert({
    phone_number: phoneNumber,
    direction: "outbound",
    message_type: "template",
    message_body: `[template:${curriculumDay.template_name}]`,
    whatsapp_message_id: result.messageId,
    status: result.ok ? "sent" : "failed",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to send message" }, { status: 502 });
  }

  await supabase
    .from("users")
    .update({ current_day: user.current_day + 1 })
    .eq("phone_number", phoneNumber);

  return NextResponse.json({ ok: true });
}
