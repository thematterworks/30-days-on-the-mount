import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/** Reads a system_config value, or `fallback` if the key is missing. */
export async function getSystemConfigValue(key: string, fallback = ""): Promise<string> {
  const { data } = await getSupabaseAdmin()
    .from("system_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? fallback;
}

export async function isAiAutoReplyEnabled(): Promise<boolean> {
  const value = await getSystemConfigValue("ai_auto_reply_enabled", "true");
  return value === "true";
}

export async function getAiPersonaSystemPrompt(): Promise<string> {
  return getSystemConfigValue(
    "ai_persona_system_prompt",
    "You are a quiet companion accompanying someone through a 30-day spiritual immersion practice.",
  );
}
