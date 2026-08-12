import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendTemplateMessage } from "@/lib/whatsapp";
import { sendCurriculumEmail } from "@/lib/email";
import { getEmailTheme } from "@/lib/system-config";
import { DEFAULT_PREFERRED_HOUR, DEFAULT_TIMEZONE, getLocalHour } from "@/lib/timezone";

export const maxDuration = 300;

/**
 * Daily push: runs hourly (see vercel.json). For every active participant
 * whose preferred local hour matches the current hour in their timezone, it
 * sends the *next* day's curriculum template (current_day + 1) and advances
 * current_day to match, then — if they opted into email during onboarding —
 * sends the same day's content by email.
 *
 * current_day for an active participant always reflects the last day
 * actually delivered — Day 0 is sent in real time by the webhook's
 * completeOnboardingAndActivate() when a pending participant finishes
 * onboarding, not by this cron. So the first run after activation must send
 * Day 1, not resend Day 0; querying curriculum_days by current_day + 1 is
 * what makes that correct instead of duplicating the welcome message.
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

  const now = new Date();
  // Fetched once, outside the per-user loop below — same system_config row
  // for every recipient, so there's no reason to re-fetch it per send.
  const emailTheme = await getEmailTheme();

  let eligible = 0;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let completed = 0;
  let emailsSent = 0;
  let emailsFailed = 0;
  let emailsSkipped = 0;

  for (const user of activeUsers ?? []) {
    eligible += 1;

    const localHour = getLocalHour(user.timezone || DEFAULT_TIMEZONE, now);
    const preferredHour = user.preferred_delivery_hour ?? DEFAULT_PREFERRED_HOUR;
    if (localHour === null || localHour !== preferredHour) {
      continue; // not this participant's hour — check again next run
    }

    processed += 1;
    const nextDay = user.current_day + 1;

    const { data: curriculumDay } = await supabase
      .from("curriculum_days")
      .select("template_name, title, fallback_text")
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

    if (!result.ok) {
      failed += 1;
      continue;
    }

    succeeded += 1;
    await supabase.from("users").update({ current_day: nextDay }).eq("phone_number", user.phone_number);

    if (user.wants_email && user.email_address) {
      const emailResult = await sendCurriculumEmail({
        to: user.email_address,
        dayTitle: curriculumDay.title,
        dayText: curriculumDay.fallback_text,
        theme: emailTheme,
      });
      if (emailResult.skipped) {
        emailsSkipped += 1;
      } else if (emailResult.ok) {
        emailsSent += 1;
      } else {
        emailsFailed += 1;
      }
    }
  }

  return NextResponse.json({
    eligible,
    processed,
    succeeded,
    failed,
    completed,
    emailsSent,
    emailsFailed,
    emailsSkipped,
  });
}
