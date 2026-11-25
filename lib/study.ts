import "server-only";
import crypto from "node:crypto";
import { type ScriptureStudy, generateScriptureStudy } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Studies are written once per passage and kept, so the second reader of
// Matthew 5:3 gets it instantly and it's paid for once. Bump VERSION to
// have every study written afresh (after changing the prompt, say).
const BUCKET = "study";
const VERSION = "v1";

export async function studyFor(reference: string, text: string): Promise<ScriptureStudy | null> {
  const path = `${VERSION}/${crypto.createHash("sha256").update(`${reference}|${text}`).digest("hex")}.json`;
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
