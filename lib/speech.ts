import "server-only";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { timed } from "@/lib/timing";

// The app's voice: Qara's ElevenLabs narrator, for scripture read aloud, the
// companion's replies, and the welcome. Same voice, model and settings as
// qara_bible/supabase/functions/elevenLabsTextToSpeech, so both apps sound
// like one person.
//
// Configure with ELEVENLABS_API_KEY (QARA_ELEVENLABS_API_KEY also accepted).
// Optional: ELEVENLABS_VOICE_ID to change the voice.

const QARA_VOICE_ID = "uIZsnBL0YK1S5j69bAih";
const MODEL_ID = "eleven_multilingual_v2";
const BUCKET = "speech";
const SIGNED_URL_SECONDS = 60 * 60;
export const MAX_SPEECH_CHARACTERS = 5000;

function apiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY?.trim() || process.env.QARA_ELEVENLABS_API_KEY?.trim() || null;
}

export function isSpeechConfigured(): boolean {
  return apiKey() !== null;
}

/** Bracketed stage directions are for the page, not the voice (as in Qara). */
export function speakableText(text: string): string {
  return text.replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
}

export class SpeechError extends Error {}

/**
 * A playable URL for `text` in the app's voice. Synthesized once and kept in
 * storage under a hash of voice, model and text, so a passage heard by a
 * thousand people is paid for once.
 */
export async function speechUrl(rawText: string): Promise<string> {
  const key = apiKey();
  if (!key) throw new SpeechError("The voice isn't set up yet.");
  const text = speakableText(rawText);
  if (!text) throw new SpeechError("Nothing to read.");

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || QARA_VOICE_ID;
  const path = `${crypto.createHash("sha256").update(`${voiceId}|${MODEL_ID}|${text}`).digest("hex")}.mp3`;
  const storage = getSupabaseAdmin().storage.from(BUCKET);

  const cached = await storage.createSignedUrl(path, SIGNED_URL_SECONDS);
  if (cached.data?.signedUrl) return cached.data.signedUrl;

  const response = await timed("speech:elevenlabs", () =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        // Multilingual v2 rather than Qara's turbo model: these are stored
        // and replayed, so fidelity matters more than time-to-first-byte.
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }),
  );
  if (!response.ok) {
    console.error("ElevenLabs synthesis failed", response.status, await response.text().catch(() => ""));
    throw new SpeechError("The voice is resting right now. Try again in a moment.");
  }

  const audio = Buffer.from(await response.arrayBuffer());
  const upload = await storage.upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (upload.error) console.error("Couldn't cache synthesized speech", upload.error);

  const signed = await storage.createSignedUrl(path, SIGNED_URL_SECONDS);
  if (!signed.data?.signedUrl) throw new SpeechError("The voice is resting right now. Try again in a moment.");
  return signed.data.signedUrl;
}
