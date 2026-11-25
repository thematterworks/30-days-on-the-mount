import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sendAppNotification } from "@/lib/apns";
import { env } from "@/lib/env";
import { bareDayTitle } from "@/lib/messaging";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_PREFERRED_HOUR, DEFAULT_TIMEZONE, getLocalDate, getLocalHour } from "@/lib/timezone";

export const maxDuration = 300;

/**
 * Hours between a participant's morning delivery and the midday invitation.
 * 4 puts it at noon for the default 08:00 morning.
 */
const MIDDAY_OFFSET_HOURS = 4;

/**
 * Midday invitation: runs hourly alongside daily-push and evening-checkin
 * (.github/workflows/scheduled-messaging.yml). The middle of the three daily
 * touchpoints — one phrase of the day's scripture brought close, opening the
 * day's "Going deeper" teaching.
 *
 * App notification only. It never falls back to a text: the SMS program's
 * registered message frequency is two a day, so SMS participants without
 * the app simply don't get it. Skipped for anyone who turned it off in
 * Profile, and for any day whose midday_push_text is blank.
 *
 * Once per local day per participant, recorded in users.midday_sent_on.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: users, error } = await supabase
    .from("users")
    .select("phone_number, current_day, timezone, preferred_delivery_hour, midday_sent_on, midday_invitations")
    .eq("status", "active")
    .eq("midday_invitations", true)
    .gte("current_day", 1)
    .lte("current_day", 31);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: days } = await supabase
    .from("curriculum_days")
    .select("day_number, title, midday_push_text")
    .gte("day_number", 1)
    .lte("day_number", 31);
  const dayByNumber = new Map((days ?? []).map((day) => [day.day_number, day]));

  const now = new Date();
  let processed = 0;
  let delivered = 0;
  let noDevice = 0;
  let alreadySentToday = 0;

  for (const user of users ?? []) {
    const timezone = user.timezone || DEFAULT_TIMEZONE;
    const localHour = getLocalHour(timezone, now);
    const localDate = getLocalDate(timezone, now);
    const targetHour = ((user.preferred_delivery_hour ?? DEFAULT_PREFERRED_HOUR) + MIDDAY_OFFSET_HOURS) % 24;
    if (localHour === null || localDate === null || localHour !== targetHour) continue;
    if (user.midday_sent_on === localDate) {
      alreadySentToday += 1;
      continue;
    }

    const day = dayByNumber.get(user.current_day);
    const body = day?.midday_push_text?.trim();
    if (!day || !body) continue;

    processed += 1;
    // Recorded before sending, so an overlapping run can't send it twice.
    await supabase.from("users").update({ midday_sent_on: localDate }).eq("phone_number", user.phone_number);

    const accepted = await sendAppNotification(user.phone_number, {
      title: `Day ${user.current_day} · Going deeper`,
      body,
      link: `mount://day/${user.current_day}/deeper`,
      dayNumber: user.current_day,
      collapseId: `midday-${user.current_day}`,
    });
    if (accepted > 0) {
      delivered += 1;
      await supabase.from("message_logs").insert({
        phone_number: user.phone_number,
        direction: "outbound",
        message_type: "template",
        message_body: `[template:midday_${String(user.current_day).padStart(2, "0")}] ${bareDayTitle(day.title)}`,
        provider_message_id: null,
        status: "sent",
        channel: "app",
      });
    } else {
      noDevice += 1;
    }
  }

  return NextResponse.json({ eligible: users?.length ?? 0, processed, delivered, noDevice, alreadySentToday });
}
