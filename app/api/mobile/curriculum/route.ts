import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileParticipant, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * The guided-story content for every open day. The app ships with the whole
 * curriculum bundled so it works offline; this lets edits made in the admin
 * reach phones without an App Store release. Days past the participant's
 * current day are withheld, matching the web journey's lock rules.
 */
export async function GET(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const { data, error } = await getSupabaseAdmin()
    .from("curriculum_days")
    .select(
      "day_number, title, hook_text, scripture_reference, scripture_text, scripture_audio_url, teaching_video_url, exegesis_text, surrender_text, ai_guidance_prompt, evening_prompt_text",
    )
    .gte("day_number", 1)
    .lte("day_number", Math.max(participant.current_day, 0))
    .order("day_number");
  if (error) return NextResponse.json({ error: "Couldn't load the journey." }, { status: 500 });

  return NextResponse.json({
    currentDay: participant.current_day,
    days: (data ?? []).map((day) => ({
      dayNumber: day.day_number,
      title: day.title,
      hook: day.hook_text,
      scriptureReference: day.scripture_reference,
      scriptureText: day.scripture_text,
      scriptureAudioURL: day.scripture_audio_url || null,
      teachingVideoURL: day.teaching_video_url || null,
      exegesis: day.exegesis_text,
      surrender: day.surrender_text,
      eveningPrompt: day.evening_prompt_text,
    })),
  });
}
