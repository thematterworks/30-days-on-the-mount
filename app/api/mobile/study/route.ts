import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AiEngineError } from "@/lib/ai";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { studyFor, studyStream } from "@/lib/study";

export const maxDuration = 60;

const MAX_PASSAGE_LENGTH = 3000;

/** A study of the chosen verses — the Bible's "Study". */
export async function POST(request: NextRequest) {
  if (!(await getMobileParticipant(request))) return unauthorized();

  const body = await readJson(request);
  const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 80) : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!reference || !text) return badRequest("Choose a verse to study.");
  if (text.length > MAX_PASSAGE_LENGTH) return badRequest("That's a long passage — choose a few verses to study.");

  // The app asks for the study as it's written, so it appears within a
  // moment instead of all at once at the end.
  if (request.headers.get("accept")?.includes("application/x-ndjson")) {
    return new Response(studyStream(reference, text), {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
    });
  }

  try {
    const study = await studyFor(reference, text);
    if (!study) return NextResponse.json({ error: "This passage couldn't be studied just now." }, { status: 502 });
    return NextResponse.json({ study });
  } catch (error) {
    console.error("Study failed", error instanceof AiEngineError ? error.message : error);
    return NextResponse.json({ error: "The study couldn't be written just now. Try again in a moment." }, { status: 502 });
  }
}
