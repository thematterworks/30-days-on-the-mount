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

export interface ReflectionReplyInput {
  personaSystemPrompt: string;
  dayNumber: number;
  dayTitle: string;
  dayAiGuidancePrompt: string;
  userMessage: string;
}

/** Thrown by generateReflectionReply with a message safe to show an admin. */
export class AiEngineError extends Error {}

/**
 * Generates an empathetic reflection reply grounded in the global AI
 * persona and the current day's specific guidance. Single-turn — the
 * WhatsApp conversation history isn't replayed to keep each reply
 * focused on the participant's most recent reflection.
 */
export async function generateReflectionReply(input: ReflectionReplyInput): Promise<string> {
  const system = [
    input.personaSystemPrompt,
    `The participant is on Day ${input.dayNumber}: "${input.dayTitle}".`,
    input.dayAiGuidancePrompt ? `Guidance specific to this day: ${input.dayAiGuidancePrompt}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  let response;
  try {
    response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: input.userMessage }],
    });
  } catch (error) {
    throw new AiEngineError(describeAnthropicError(error));
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (response.stop_reason === "refusal" || !textBlock) {
    return "Thank you for sharing that. I'm here with you — feel free to say more whenever you're ready.";
  }

  return textBlock.text.trim();
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
