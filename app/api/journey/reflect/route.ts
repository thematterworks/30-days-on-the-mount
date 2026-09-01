import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentParticipant } from "@/lib/participant-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAiPersonaSystemPrompt } from "@/lib/system-config";
import { AiEngineError, generateCuriousInspectorQuestion } from "@/lib/ai";

/**
 * The Curious Inspector (GuidedStory Screen 4). Takes the participant's
 * written reflection for a day and returns one piercing question. Gated on
 * the participant session (premium + active) — not proxy.ts, which only
 * covers /admin. A participant may only reflect on a day at or before their
 * current day (no skipping ahead), matching the home-screen lock rules.
 */
export async function POST(request: NextRequest) {
  const participant = await getCurrentParticipant();
  if (!participant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { dayNumber?: number; reflection?: string } | null;
  const dayNumber = body?.dayNumber;
  const reflection = body?.reflection?.trim();

  if (typeof dayNumber !== "number" || !Number.isInteger(dayNumber) || !reflection) {
    return NextResponse.json({ error: "dayNumber and reflection are required" }, { status: 400 });
  }
  if (dayNumber < 1 || dayNumber > participant.current_day) {
    return NextResponse.json({ error: "That day isn't open yet" }, { status: 403 });
  }

  const { data: day } = await getSupabaseAdmin()
    .from("curriculum_days")
    .select("title, ai_guidance_prompt")
    .eq("day_number", dayNumber)
    .maybeSingle();

  const personaSystemPrompt = await getAiPersonaSystemPrompt();

  try {
    const question = await generateCuriousInspectorQuestion({
      personaSystemPrompt,
      dayNumber,
      dayTitle: day?.title ?? `Day ${dayNumber}`,
      dayAiGuidancePrompt: day?.ai_guidance_prompt ?? "",
      reflection,
    });
    return NextResponse.json({ question });
  } catch (error) {
    const message = error instanceof AiEngineError ? error.message : "The Inspector is quiet right now.";
    console.error("Curious Inspector failed", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
