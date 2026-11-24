import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AiEngineError, generateCuriousInspectorQuestion } from "@/lib/ai";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAiPersonaSystemPrompt } from "@/lib/system-config";

/** The Curious Inspector for the app — the same rules as /api/journey/reflect. */
export async function POST(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const body = await readJson(request);
  const dayNumber = body.dayNumber;
  const reflection = typeof body.reflection === "string" ? body.reflection.trim() : "";
  if (typeof dayNumber !== "number" || !Number.isInteger(dayNumber) || !reflection) {
    return badRequest("dayNumber and reflection are required");
  }
  if (dayNumber < 1 || dayNumber > participant.current_day) {
    return NextResponse.json({ error: "That day isn't open yet" }, { status: 403 });
  }

  const { data: day } = await getSupabaseAdmin()
    .from("curriculum_days")
    .select("title, ai_guidance_prompt")
    .eq("day_number", dayNumber)
    .maybeSingle();

  try {
    const question = await generateCuriousInspectorQuestion({
      personaSystemPrompt: await getAiPersonaSystemPrompt(),
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
