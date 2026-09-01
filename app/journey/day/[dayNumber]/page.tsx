import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentParticipant } from "@/lib/participant-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { GuidedStory } from "@/components/journey/GuidedStory";
import type { GuidedStoryDay } from "@/components/journey/types";

export const metadata: Metadata = {
  title: "30 Days on the Mount",
  robots: { index: false },
};

/**
 * A single day's GuidedStory. Enforces the premium gate and the
 * no-skipping-ahead rule (only days at or before current_day are openable,
 * mirroring the locked home-screen cards), then loads the day's structured
 * content and hands it to the client GuidedStory.
 */
export default async function JourneyDayPage({ params }: PageProps<"/journey/day/[dayNumber]">) {
  const participant = await getCurrentParticipant();
  if (!participant) {
    redirect("/journey/expired");
  }

  const dayNumber = Number((await params).dayNumber);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > participant.current_day) {
    redirect("/journey");
  }

  const { data: row } = await getSupabaseAdmin()
    .from("curriculum_days")
    .select(
      "day_number, title, hook_text, scripture_reference, scripture_text, scripture_audio_url, teaching_video_url, exegesis_text, surrender_text, media_url",
    )
    .eq("day_number", dayNumber)
    .maybeSingle();

  if (!row) {
    redirect("/journey");
  }

  const day: GuidedStoryDay = row;

  return <GuidedStory day={day} />;
}
