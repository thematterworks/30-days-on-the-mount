import "server-only";
import Anthropic, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { timed } from "@/lib/timing";

// Claude Sonnet 5. Chosen over the Opus tier for latency: these are short,
// single-turn SMS replies (200-512 tokens), where time-to-first-token
// dominates the participant's experience far more than reasoning depth.
const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.AI_API_KEY });
  }
  return client;
}

/** Thrown by generateReflectionReply/generateGatekeeperReply with a message safe to show an admin. */
export class AiEngineError extends Error {}

/**
 * Single-turn call to the AI engine. Returns `null` (rather than a fallback
 * string) on refusal or an empty response, leaving the caller to decide
 * what fallback text fits its context.
 */
async function callClaude(system: string, userMessage: string, maxTokens: number): Promise<string | null> {
  let response;
  try {
    response = await timed("anthropic", () =>
      getClient().messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        // Set explicitly to preserve the previous behaviour rather than
        // change it: Opus 4.8 ran without thinking when this parameter was
        // omitted, whereas Sonnet 5 runs *adaptive* thinking when omitted.
        // Leaving it off would have switched thinking on as a side effect of
        // the model swap.
        //
        // Adaptive means the model decides per request, so the cost is a
        // latency spike on some turns rather than all of them — and thinking
        // tokens count against max_tokens, which is a real hazard for
        // extractPreferredHour (20) and detectYesNo (10): a turn that chose
        // to think could spend the whole budget and return no text block,
        // making those helpers answer null. Disabling makes reply latency
        // predictable and keeps those two budgets available for the answer.
        thinking: { type: "disabled" },
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
    );
  } catch (error) {
    throw new AiEngineError(describeAnthropicError(error));
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (response.stop_reason === "refusal" || !textBlock) {
    return null;
  }

  return textBlock.text.trim();
}

export interface ReflectionReplyInput {
  personaSystemPrompt: string;
  dayNumber: number;
  dayTitle: string;
  dayAiGuidancePrompt: string;
  userMessage: string;
}

/**
 * Generates an empathetic reflection reply grounded in the global AI
 * persona and the current day's specific guidance. Single-turn — the
 * WhatsApp conversation history isn't replayed to keep each reply
 * focused on the participant's most recent reflection. Used for
 * already-active participants (status = 'active').
 */
export async function generateReflectionReply(input: ReflectionReplyInput): Promise<string> {
  const system = [
    input.personaSystemPrompt,
    `The participant is on Day ${input.dayNumber}: "${input.dayTitle}".`,
    input.dayAiGuidancePrompt ? `Guidance specific to this day: ${input.dayAiGuidancePrompt}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const text = await callClaude(system, input.userMessage, 512);
  return text ?? "Thank you for sharing that. I'm here with you — feel free to say more whenever you're ready.";
}

export interface CuriousInspectorInput {
  personaSystemPrompt: string;
  dayNumber: number;
  dayTitle: string;
  dayAiGuidancePrompt: string;
  reflection: string;
}

/**
 * The Curious Inspector (GuidedStory Screen 4). Unlike generateReflectionReply
 * — which offers a warm, complete pastoral reply for the text track — this
 * returns exactly ONE piercing, non-accusatory question that turns the
 * participant back toward their own resistance. It deliberately does not
 * affirm, summarize, advise, or answer: in the PWA the question replaces the
 * input, so anything more than a single question would break the "one thing
 * at a time" sanctuary UX.
 */
export async function generateCuriousInspectorQuestion(input: CuriousInspectorInput): Promise<string> {
  const system = [
    input.personaSystemPrompt,
    "You are acting as the Curious Inspector during a daily guided reflection. " +
      "Read the participant's written reflection and respond with EXACTLY ONE short, piercing, non-accusatory " +
      "question that invites them to look more honestly at their own resistance, avoidance, or the story they " +
      "are telling themselves. Do not affirm, summarize, praise, advise, reassure, or answer. Do not add any " +
      "preamble or closing. Output only the single question, and nothing else.",
    `The participant is on Day ${input.dayNumber}: "${input.dayTitle}".`,
    input.dayAiGuidancePrompt ? `Guidance specific to this day: ${input.dayAiGuidancePrompt}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const text = await callClaude(system, input.reflection, 200);
  return text ?? "What are you not letting yourself say about this yet?";
}

/**
 * The exact string the Gatekeeper is instructed to reply with — and only
 * with — when it judges the participant ready to begin. The webhook
 * intercepts this server-side; it is never sent to WhatsApp.
 */
export const GATEKEEPER_TRIGGER = "[TRIGGER_DAY_ZERO]";

const GATEKEEPER_SYSTEM_PROMPT =
  "The user is in the waiting room for a 30-day spiritual challenge and has not started yet. " +
  "Your only job is to determine if they are indicating they are ready to begin " +
  '(e.g., "start", "begin", "I\'m ready", "let\'s go"). If they are ready, reply with ONLY the exact string: ' +
  "[TRIGGER_DAY_ZERO]. If they are asking a question or saying anything else, reply briefly and politely, " +
  "answer their question, and ask them to let you know when they are ready to start. " +
  "Do not engage in deep conversational dialogue.";

/**
 * Gatekeeper for freeform messages from participants still in the waiting
 * room (status = 'pending'). Distinct persona/system-prompt from
 * generateReflectionReply on purpose — its only job is triage, not
 * reflection. Returns either GATEKEEPER_TRIGGER or a short reply to send
 * as-is.
 */
export async function generateGatekeeperReply(userMessage: string): Promise<string> {
  const text = await callClaude(GATEKEEPER_SYSTEM_PROMPT, userMessage, 200);
  return text ?? "Whenever you're ready to begin, just let me know!";
}

/**
 * Reply to a participant responding to their evening check-in — distinct
 * pastoral-care persona from the daily reflection AI on purpose: no
 * checklist/grade/fix, just validating the day's friction and pointing
 * back to grace and rest. `eveningSystemPrompt` comes from system_config
 * (evening_reflection_system_prompt), editable from the admin dashboard.
 */
export async function generateEveningReflectionReply(
  eveningSystemPrompt: string,
  userMessage: string,
): Promise<string> {
  const text = await callClaude(eveningSystemPrompt, userMessage, 512);
  return text ?? "Whatever today held, you are held too. Rest well tonight — grace doesn't keep score.";
}

const EXTRACT_HOUR_SYSTEM_PROMPT =
  "The user is choosing what hour of the day they want to receive their daily message for a 30-day spiritual " +
  "practice. Determine the hour they mean, in 24-hour format (0-23), local to their own stated time — do not " +
  "perform any timezone conversion, just interpret the hour as they said it. Interpret vague terms reasonably: " +
  '"morning" -> 8, "afternoon" -> 14, "evening" -> 19, "night" -> 21, "noon" -> 12, "midnight" -> 0. If they give ' +
  'a specific time (e.g. "7am", "7:30pm", "18:00", "around 6 in the evening"), convert it precisely to 24-hour ' +
  "format and round to the nearest whole hour. Reply with ONLY the hour as a plain integer from 0 to 23 — no " +
  "other text, no punctuation, no explanation. If their message does not indicate any time at all, reply with " +
  "ONLY the word UNKNOWN.";

/**
 * Extracts a 0-23 local hour from a freeform reply during onboarding
 * (status = 'pending', onboarding_step = 'awaiting_time'). Returns null if
 * Claude can't determine a specific hour, so the caller can ask again
 * instead of guessing.
 */
export async function extractPreferredHour(userMessage: string): Promise<number | null> {
  const text = await callClaude(EXTRACT_HOUR_SYSTEM_PROMPT, userMessage, 20);
  if (!text) return null;

  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;

  const hour = Number(trimmed);
  return hour >= 0 && hour <= 23 ? hour : null;
}

const DETECT_YES_NO_SYSTEM_PROMPT =
  "The user is being asked a yes/no question about whether they want to also receive their daily messages by " +
  "email, in addition to text message. Determine whether their reply means yes or no. Reply with ONLY the word YES " +
  "or ONLY the word NO — no other text. If their message is genuinely ambiguous and does not indicate yes or " +
  "no, reply with ONLY the word UNKNOWN.";

/**
 * Detects yes/no from a freeform reply during onboarding (awaiting_email_pref).
 * Returns null if genuinely ambiguous, so the caller can ask again.
 */
export async function detectYesNo(userMessage: string): Promise<boolean | null> {
  const text = await callClaude(DETECT_YES_NO_SYSTEM_PROMPT, userMessage, 10);
  if (!text) return null;

  const normalized = text.trim().toUpperCase();
  if (normalized === "YES") return true;
  if (normalized === "NO") return false;
  return null;
}

/** Maps Anthropic SDK errors to a specific, actionable message for admins. */
function describeAnthropicError(error: unknown): string {
  if (error instanceof AuthenticationError) {
    return "AI Engine authentication failed — AI_API_KEY (or ANTHROPIC_API_KEY) is missing, invalid, or revoked. Check the value in Vercel's environment variables and confirm there's no extra whitespace.";
  }
  if (error instanceof PermissionDeniedError) {
    return "AI Engine permission denied — this API key doesn't have access to the requested model or feature.";
  }
  if (error instanceof NotFoundError) {
    return `AI Engine model not found — "${MODEL}" may be unavailable for this API key.`;
  }
  if (error instanceof RateLimitError) {
    return "AI Engine rate limited — too many requests to Anthropic right now. Try again shortly.";
  }
  if (error instanceof APIConnectionError) {
    return "AI Engine connection failed — could not reach the Anthropic API from this deployment.";
  }
  if (error instanceof APIError) {
    return `AI Engine error (HTTP ${error.status}): ${error.message}`;
  }
  return error instanceof Error ? `AI Engine error: ${error.message}` : "AI Engine error: unknown failure";
}
