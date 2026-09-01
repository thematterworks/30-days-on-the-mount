import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentParticipant } from "@/lib/participant-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { JourneyStack, type JourneyDay } from "@/components/journey/JourneyStack";

export const metadata: Metadata = {
  title: "30 Days on the Mount",
  robots: { index: false },
};

/**
 * The Secret Room home screen. Server component: enforces the premium gate,
 * loads the participant and the 30-day curriculum, and hands the stack to
 * the client JourneyStack. Days 1–30 are the journey (Day 0 is the
 * onboarding welcome and isn't shown as a climbable card).
 */
export default async function JourneyHomePage() {
  const participant = await getCurrentParticipant();
  if (!participant) {
    // Not signed in / not active / not premium — bounce without leaking
    // that the route exists.
    redirect("/journey/expired");
  }

  const { data: rows } = await getSupabaseAdmin()
    .from("curriculum_days")
    .select("day_number, title")
    .gte("day_number", 1)
    .lte("day_number", 30)
    .order("day_number", { ascending: true });

  const days: JourneyDay[] = rows ?? [];

  return <JourneyStack days={days} currentDay={participant.current_day} />;
}
