import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isUnsubscribedRecipientError, sendPushToChannel } from "@/lib/messaging";
import { getEveningCheckinFallbackText, getEveningCheckinTemplateName } from "@/lib/system-config";
import { DEFAULT_PREFERRED_HOUR, DEFAULT_TIMEZONE, getLocalDate, getLocalHour } from "@/lib/timezone";

export const maxDuration = 300;

/**
 * Hours between a participant's morning delivery and their evening check-in.
 * 11 puts the evening touchpoint at 19:00 for the default 08:00 morning hour.
 */
const EVENING_OFFSET_HOURS = 11;

/**
 * Evening check-in: runs hourly (see
 * .github/workflows/scheduled-messaging.yml — not a Vercel cron), same shape as
 * daily-push. Invites active participants to reflect on whether they
 * completed the day's practice and process any friction. Unlike
 * daily-push, this does not advance current_day — it's a second touchpoint
 * on the same day, not progress.
 *
 * Dispatch is channel-aware: WhatsApp participants get the generic
 * Meta-approved evening_checkin_template_name template (a per-day template
 * would require separate Meta approval for each day); Twilio SMS
 * participants get the day's specific curriculum_days.evening_prompt_text
 * sent directly, falling back to evening_checkin_fallback_text if that
 * day's prompt is empty.
 *
 * Sets evening_sent_at and resets evening_completed to false on every send,
 * which lib/conversation-engine.ts uses to recognize a participant's next
 * freeform reply as responding to tonight's check-in (across both
 * channels) instead of inferring it from the most recent outbound
 * template body.
 *
 * Target hour is derived from preferred_delivery_hour rather than stored
 * separately, so it always stays EVENING_OFFSET_HOURS after whatever morning
 * hour applies to the participant (e.g. the default 08:00 morning -> 19:00
 * evening), including wrapping past midnight for anyone whose morning hour is
 * late (e.g. 15:00 morning -> 02:00 evening, via modulo).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const templateName = await getEveningCheckinTemplateName();
  const genericFallbackText = await getEveningCheckinFallbackText();

  const { data: activeUsers, error } = await supabase
    .from("users")
    .select("*")
    .eq("status", "active")
    .gte("current_day", 0)
    .lte("current_day", 31);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();

  let eligible = 0;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let autoOptedOut = 0;
  let alreadySentToday = 0;

  for (const user of activeUsers ?? []) {
    eligible += 1;

    const timezone = user.timezone || DEFAULT_TIMEZONE;
    const localHour = getLocalHour(timezone, now);
    const localDate = getLocalDate(timezone, now);
    const preferredHour = user.preferred_delivery_hour ?? DEFAULT_PREFERRED_HOUR;
    const targetEveningHour = (preferredHour + EVENING_OFFSET_HOURS) % 24;

    if (localHour === null || localDate === null || localHour !== targetEveningHour) {
      continue; // not this participant's evening hour — check again next run
    }

    // Same one-per-local-day guarantee daily-push has, derived from the
    // evening_sent_at timestamp this endpoint already maintains rather than a
    // second column. A duplicate here costs a participant a redundant text
    // rather than a lost day of curriculum, but it is still an unwanted
    // message to someone who did not ask for two.
    if (user.evening_sent_at && getLocalDate(timezone, new Date(user.evening_sent_at)) === localDate) {
      alreadySentToday += 1;
      continue;
    }

    processed += 1;

    const { data: curriculumDay } = await supabase
      .from("curriculum_days")
      .select("evening_prompt_text")
      .eq("day_number", user.current_day)
      .maybeSingle();

    const smsBody = curriculumDay?.evening_prompt_text?.trim() || genericFallbackText;
    const result = await sendPushToChannel(user.channel, user.phone_number, templateName, smsBody);

    await supabase.from("message_logs").insert({
      phone_number: user.phone_number,
      direction: "outbound",
      message_type: "template",
      message_body: `[template:${templateName}]`,
      provider_message_id: result.messageId,
      status: result.ok ? "sent" : "failed",
      channel: user.channel,
    });

    if (result.ok) {
      succeeded += 1;
      await supabase
        .from("users")
        .update({ evening_sent_at: now.toISOString(), evening_completed: false })
        .eq("phone_number", user.phone_number);
    } else {
      failed += 1;
      // Same reconciliation as daily-push: a 21610 means Twilio's Advanced
      // Opt-Out already suppressed this number on a STOP we never received.
      if (isUnsubscribedRecipientError(result)) {
        await supabase.from("users").update({ status: "opted_out" }).eq("phone_number", user.phone_number);
        autoOptedOut += 1;
      }
    }
  }

  return NextResponse.json({ eligible, processed, succeeded, failed, autoOptedOut, alreadySentToday });
}
