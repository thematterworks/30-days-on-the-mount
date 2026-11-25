import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { VoiceChatError, cleanVariables, conversationToken } from "@/lib/voice-chat";

/**
 * Starts a spoken conversation with the companion: a conversation token, and the
 * agent's dynamic variables — where the participant is (sent by the app)
 * and who they are (added here).
 */
export async function POST(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const variables = {
    // The agent opens with {{opening}}; older app builds don't send one.
    opening: "What's on your heart today?",
    ...cleanVariables((await readJson(request)).variables),
    first_name: participant.first_name ?? "friend",
    current_day: String(participant.current_day ?? 1),
  };
  try {
    return NextResponse.json({ token: await conversationToken(), variables });
  } catch (error) {
    const message = error instanceof VoiceChatError ? error.message : "Your companion can't talk right now.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

const MAX_TURNS = 120;

/** Without the agent's delivery cues ("[warmly]"), which are for the voice, not the page. */
function spokenText(text: string): string {
  return text.replace(/\[[^\]]*\]/g, "").replace(/[ \t]{2,}/g, " ").replace(/ ([,.!?;:])/g, "$1").trim();
}
const MAX_TURN_LENGTH = 4000;

/**
 * Keeps what was said: a finished conversation's transcript joins the
 * companion history, so talking and writing are one conversation.
 */
export async function PUT(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const transcript = (await readJson(request)).transcript;
  if (!Array.isArray(transcript)) return badRequest("transcript must be a list.");
  const turns = transcript
    .filter(
      (turn): turn is { role: string; text: string } =>
        (turn?.role === "user" || turn?.role === "agent") && typeof turn?.text === "string" && spokenText(turn.text) !== "",
    )
    .slice(0, MAX_TURNS);
  if (turns.length === 0) return NextResponse.json({ ok: true });

  // A millisecond apart, so the history keeps them in order.
  const start = Date.now();
  const rows = turns.map((turn, index) => ({
    phone_number: participant.phone_number,
    direction: turn.role === "user" ? ("inbound" as const) : ("outbound" as const),
    message_type: turn.role === "user" ? ("freeform" as const) : ("ai_generated" as const),
    message_body: spokenText(turn.text).slice(0, MAX_TURN_LENGTH),
    provider_message_id: `voice_${crypto.randomUUID()}`,
    status: "delivered" as const,
    channel: "app" as const,
    created_at: new Date(start + index).toISOString(),
  }));
  const { error } = await getSupabaseAdmin().from("message_logs").insert(rows);
  if (error) {
    console.error("Saving a voice transcript failed", error);
    return NextResponse.json({ error: "Couldn't save the conversation." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
