import "server-only";

// Spoken conversations with Qara, through an ElevenLabs agent. The app never
// holds the API key: it asks this server for a short-lived conversation
// token, and the call itself runs between the phone and ElevenLabs.
//
// Requires ELEVENLABS_API_KEY with access to agents. Optional:
// ELEVENLABS_AGENT_ID to use a different agent.
const QARA_AGENT_ID = "agent_7301khydkzmrf8y88jctcd95a3eh";

function apiKey() {
  return process.env.ELEVENLABS_API_KEY?.trim() || process.env.QARA_ELEVENLABS_API_KEY?.trim() || "";
}

export function isVoiceChatConfigured(): boolean {
  return Boolean(apiKey());
}

export class VoiceChatError extends Error {}

/** A token the app starts one conversation with. */
export async function conversationToken(): Promise<string> {
  const key = apiKey();
  if (!key) throw new VoiceChatError("Talking with Qara isn't set up yet.");
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim() || QARA_AGENT_ID;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": key } },
  );
  if (!response.ok) {
    console.error("ElevenLabs conversation token failed", response.status, await response.text().catch(() => ""));
    throw new VoiceChatError("Qara can't talk right now. Try again in a moment.");
  }
  const { token } = (await response.json()) as { token?: string };
  if (!token) throw new VoiceChatError("Qara can't talk right now. Try again in a moment.");
  return token;
}

/**
 * The agent's dynamic variables the app may fill — where the participant is
 * in the Bible or the journey. Anything else is dropped, and values are
 * kept short.
 */
const APP_VARIABLES = [
  "activeWord",
  "bookName",
  "chapter",
  "scripture_ref",
  "user_input",
  "user_intent",
  "verse_text",
  "day_number",
  "day_title",
  "practice",
] as const;

export function cleanVariables(raw: unknown): Record<string, string> {
  const variables: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return variables;
  for (const name of APP_VARIABLES) {
    const value = (raw as Record<string, unknown>)[name];
    if (typeof value === "string" && value.trim()) variables[name] = value.trim().slice(0, 1200);
  }
  return variables;
}
