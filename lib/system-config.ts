import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { timed } from "@/lib/timing";
import type { EmailTheme } from "@/lib/email-template";

/** Reads a system_config value, or `fallback` if the key is missing. */
export async function getSystemConfigValue(key: string, fallback = ""): Promise<string> {
  const { data } = await timed(`cfg:${key}`, () =>
    getSupabaseAdmin().from("system_config").select("value").eq("key", key).maybeSingle(),
  );
  return data?.value ?? fallback;
}

export async function isAiAutoReplyEnabled(): Promise<boolean> {
  const value = await getSystemConfigValue("ai_auto_reply_enabled", "true");
  return value === "true";
}

export async function getAiPersonaSystemPrompt(): Promise<string> {
  return getSystemConfigValue(
    "ai_persona_system_prompt",
    "You are a quiet companion accompanying someone through a 30-day spiritual immersion practice. " +
      "When interacting with participants, constantly engage them to distinguish and discover, for themselves, " +
      "the distinct difference between the 'Bios Life' (survival, equivalent exchange, the ledger) and the " +
      "'Zoe Life' (abundance, grace, turning the cheek).",
  );
}

export async function getEveningCheckinTemplateName(): Promise<string> {
  return getSystemConfigValue("evening_checkin_template_name", "evening_check_in");
}

export async function getEveningReflectionSystemPrompt(): Promise<string> {
  return getSystemConfigValue(
    "evening_reflection_system_prompt",
    "You are responding to a participant's evening check-in reply. Validate their friction, remind them the goal is " +
      "awareness and surrender rather than perfection, and point them back to grace. Keep it brief and warm.",
  );
}

/**
 * Generic SMS evening check-in body, used when the active day's
 * curriculum_days.evening_prompt_text is empty. Not used for WhatsApp,
 * which always sends the approved evening_checkin_template_name template.
 */
export async function getEveningCheckinFallbackText(): Promise<string> {
  return getSystemConfigValue(
    "evening_checkin_fallback_text",
    "How did today's practice sit with you? Reply and let me know what came up.",
  );
}

const EMAIL_THEME_KEY = "email_theme_v1";

export const DEFAULT_EMAIL_THEME: EmailTheme = {
  background_gradient: "linear-gradient(135deg, #4A4E7E 0%, #313554 100%)",
  primary_accent_color: "#D2B48C",
  secondary_accent_color: "#FFFFFF",
  main_font_family: "Georgia, 'Times New Roman', serif",
  alt_font_family: "Helvetica, Arial, sans-serif",
  body_text_color: "#FFFFFF",
  header_mountain_image_url: "",
  title_font_size: "32px",
  subtext_font_size: "14px",
  body_font_size: "16px",
  line_height: "1.6",
};

/**
 * Reads the email visual theme. Stored as a JSON string in system_config's
 * `value` (text) column — see migration 0006 for why this isn't a jsonb
 * column. Falls back to DEFAULT_EMAIL_THEME if the row is missing or the
 * stored value somehow isn't valid JSON, so a malformed edit can never take
 * email sending down.
 */
export async function getEmailTheme(): Promise<EmailTheme> {
  const raw = await getSystemConfigValue(EMAIL_THEME_KEY, "");
  if (!raw) return DEFAULT_EMAIL_THEME;

  try {
    const parsed = JSON.parse(raw) as Partial<EmailTheme>;
    return { ...DEFAULT_EMAIL_THEME, ...parsed };
  } catch {
    console.error(`system_config.${EMAIL_THEME_KEY} is not valid JSON — falling back to the default email theme`);
    return DEFAULT_EMAIL_THEME;
  }
}

/** Persists the full email theme (callers should merge over getEmailTheme() first, not send a partial). */
export async function updateEmailTheme(theme: EmailTheme): Promise<void> {
  await getSupabaseAdmin()
    .from("system_config")
    .update({ value: JSON.stringify(theme) })
    .eq("key", EMAIL_THEME_KEY);
}
