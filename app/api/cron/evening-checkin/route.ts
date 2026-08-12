import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendTemplateMessage } from "@/lib/whatsapp";
import { getEveningCheckinTemplateName } from "@/lib/system-config";
import { DEFAULT_PREFERRED_HOUR, DEFAULT_TIMEZONE, getLocalHour } from "@/lib/timezone";

export const maxDuration = 300;

/** Hours between a participant's morning delivery and their evening check-in. */
const EVENING_OFFSET_HOURS = 10;

/**
 * Evening check-in: runs hourly (see vercel.json), same shape as
 * daily-push. Invites active participants to reflect on whether they
 * completed the day's practice and process any friction. Unlike
 * daily-push, this does not advance current_day — it's a second touchpoint
 * on the same day, not progress. The webhook detects replies to this
 * template (by checking the participant's most recent outbound template)
 * and routes them through the pastoral-care evening persona instead of the
 * daily reflection AI.
 *
 * Target hour is derived from preferred_delivery_hour rather than stored
 * separately, so it always stays 10 hours after whatever morning hour the
 * participant chose (e.g. 07:00 morning -> 17:00 evening), including
 * wrapping past midnight for anyone whose morning hour is late (e.g. 15:00
 * morning -> 01:00 evening, via modulo).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const templateName = await getEveningCheckinTemplateName();

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

  let eligible = 0;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const user of activeUsers ?? []) {
    eligible += 1;

    const localHour = getLocalHour(user.timezone || DEFAULT_TIMEZONE, now);
    const preferredHour = user.preferred_delivery_hour ?? DEFAULT_PREFERRED_HOUR;
    const targetEveningHour = (preferredHour + EVENING_OFFSET_HOURS) % 24;

    if (localHour === null || localHour !== targetEveningHour) {
      continue; // not this participant's evening hour — check again next run
    }

    processed += 1;

    const result = await sendTemplateMessage(user.phone_number, templateName);

    await supabase.from("message_logs").insert({
      phone_number: user.phone_number,
      direction: "outbound",
      message_type: "template",
      message_body: `[template:${templateName}]`,
      whatsapp_message_id: result.messageId,
      status: result.ok ? "sent" : "failed",
    });

    if (result.ok) {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }

  return NextResponse.json({ eligible, processed, succeeded, failed });
}
