import "server-only";
import crypto from "node:crypto";
import { type ScriptureStudy, generateScriptureStudy, streamScriptureStudy } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Studies are written once per passage and kept, so the second reader of
// Matthew 5:3 gets it instantly and it's paid for once. Bump VERSION to
// have every study written afresh (after changing the prompt, say).
const BUCKET = "study";
const VERSION = "v1";

function cachePath(reference: string, text: string) {
  return `${VERSION}/${crypto.createHash("sha256").update(`${reference}|${text}`).digest("hex")}.json`;
}

/**
 * The study as a stream of lines (NDJSON), each the study so far:
 * {"study": {...}, "done": false}, and finally {"study": {...}, "done": true}
 * (or {"error": "..."}). A kept study arrives whole, at once.
 */
export function studyStream(reference: string, text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const path = cachePath(reference, text);
  const storage = getSupabaseAdmin().storage.from(BUCKET);
  return new ReadableStream({
    async start(controller) {
      const send = (line: object) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      try {
        const { data: cached } = await storage.download(path);
        if (cached) {
          try {
            send({ study: JSON.parse(await cached.text()), done: true });
            controller.close();
            return;
          } catch {
            // Unreadable: write it again below.
          }
        }
        const study = await streamScriptureStudy(reference, text, (partial) => send({ study: partial, done: false }));
        if (!study) {
          send({ error: "This passage couldn't be studied just now." });
        } else {
          send({ study, done: true });
          await storage.upload(path, JSON.stringify(study), { contentType: "application/json", upsert: true });
        }
      } catch (error) {
        console.error("Study stream failed", error);
        send({ error: "The study couldn't be written just now. Try again in a moment." });
      }
      controller.close();
    },
  });
}

export async function studyFor(reference: string, text: string): Promise<ScriptureStudy | null> {
  const path = cachePath(reference, text);
  const storage = getSupabaseAdmin().storage.from(BUCKET);

  const { data: cached } = await storage.download(path);
  if (cached) {
    try {
      return JSON.parse(await cached.text()) as ScriptureStudy;
    } catch {
      // Unreadable: write it again below.
    }
  }

  const study = await generateScriptureStudy(reference, text);
  if (study) {
    await storage.upload(path, JSON.stringify(study), { contentType: "application/json", upsert: true });
  }
  return study;
}
