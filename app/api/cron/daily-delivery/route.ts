import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendTemplateMessage } from "@/lib/whatsapp";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: activeUsers, error } = await supabase
    .from("users")
    .select("*")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const user of activeUsers ?? []) {
    processed += 1;

    if (user.current_day > 30) {
      await supabase.from("users").update({ status: "completed" }).eq("phone_number", user.phone_number);
      continue;
    }

    const { data: curriculumDay } = await supabase
      .from("curriculum_days")
      .select("template_name")
      .eq("day_number", user.current_day)
      .maybeSingle();

    if (!curriculumDay) {
      failed += 1;
      continue;
    }

    const result = await sendTemplateMessage(user.phone_number, curriculumDay.template_name);

    await supabase.from("message_logs").insert({
      phone_number: user.phone_number,
      direction: "outbound",
      message_type: "template",
      message_body: `[template:${curriculumDay.template_name}]`,
      whatsapp_message_id: result.messageId,
      status: result.ok ? "sent" : "failed",
    });

    if (result.ok) {
      succeeded += 1;
      await supabase
        .from("users")
        .update({ current_day: user.current_day + 1 })
        .eq("phone_number", user.phone_number);
    } else {
      failed += 1;
    }
  }

  return NextResponse.json({ processed, succeeded, failed });
}
