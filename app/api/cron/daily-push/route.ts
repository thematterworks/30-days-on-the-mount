import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendTemplateMessage } from "@/lib/whatsapp";

export const maxDuration = 300;

/**
 * Daily push: for every active participant, sends the *next* day's
 * curriculum template (current_day + 1) and advances current_day to match.
 *
 * current_day for an active participant always reflects the last day
 * actually delivered — Day 0 is sent in real time by the webhook's
 * activateUser() when a pending participant is onboarded, not by this
 * cron. So the first run after activation must send Day 1, not resend
 * Day 0; querying curriculum_days by current_day + 1 is what makes that
 * correct instead of duplicating the welcome message.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: activeUsers, error } = await supabase
    .from("users")
    .select("*")
    .eq("status", "active")
    .gte("current_day", 0)
    .lte("current_day", 30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let completed = 0;

  for (const user of activeUsers ?? []) {
    processed += 1;
    const nextDay = user.current_day + 1;

    const { data: curriculumDay } = await supabase
      .from("curriculum_days")
      .select("template_name")
      .eq("day_number", nextDay)
      .maybeSingle();

    if (!curriculumDay) {
      // curriculum_days is keyed 0-30 — no row for nextDay means the
      // participant just finished the last delivered day (30).
      await supabase.from("users").update({ status: "completed" }).eq("phone_number", user.phone_number);
      completed += 1;
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
      await supabase.from("users").update({ current_day: nextDay }).eq("phone_number", user.phone_number);
    } else {
      failed += 1;
    }
  }

  return NextResponse.json({ processed, succeeded, failed, completed });
}
