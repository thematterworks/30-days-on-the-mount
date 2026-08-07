import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateReflectionReply } from "@/lib/ai";
import { getAiPersonaSystemPrompt } from "@/lib/system-config";

const DEFAULT_TEST_MESSAGE =
  "This is a test message from the admin dashboard to confirm the AI engine is configured correctly.";

/** Diagnostic endpoint: calls the AI engine once with the current persona prompt so admins can verify AI_API_KEY without waiting for a real WhatsApp message. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const userMessage = body.message?.trim() || DEFAULT_TEST_MESSAGE;

  const personaSystemPrompt = await getAiPersonaSystemPrompt();

  try {
    const reply = await generateReflectionReply({
      personaSystemPrompt,
      dayNumber: 0,
      dayTitle: "Welcome — Arriving at the Mount",
      dayAiGuidancePrompt: "",
      userMessage,
    });
    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI engine error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
