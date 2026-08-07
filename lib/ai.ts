import "server-only";
import Anthropic from "@anthropic-ai/sdk";
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

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    system,
    messages: [{ role: "user", content: input.userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (response.stop_reason === "refusal" || !textBlock) {
    return "Thank you for sharing that. I'm here with you — feel free to say more whenever you're ready.";
  }

  return textBlock.text.trim();
}
