import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { MAX_SPEECH_CHARACTERS, SpeechError, speechUrl } from "@/lib/speech";

/** Reads text aloud in the app's voice. Returns a short-lived URL to an MP3. */
export async function POST(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const text = (await readJson(request)).text;
  if (typeof text !== "string" || !text.trim()) return badRequest("Nothing to read.");
  if (text.length > MAX_SPEECH_CHARACTERS) return badRequest("That passage is too long to read in one go.");

  try {
    return NextResponse.json({ url: await speechUrl(text) });
  } catch (error) {
    if (error instanceof SpeechError) return NextResponse.json({ error: error.message }, { status: 503 });
    console.error("Speech failed", error);
    return NextResponse.json({ error: "The voice is resting right now." }, { status: 500 });
  }
}
