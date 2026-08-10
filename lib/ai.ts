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

const MODEL = "claude-opus-4-8";

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
    response = await getClient().messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
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
