import "server-only";
import { buildCurriculumEmailHtml, type EmailTheme } from "@/lib/email-template";

export interface EmailSendResult {
  ok: boolean;
  /** True when RESEND_API_KEY isn't configured — not treated as a hard failure. */
  skipped: boolean;
  error: string | null;
}

/**
 * Sends a curriculum day via email through Resend, as an alongside-WhatsApp
 * delivery channel for participants who opted in during onboarding
 * (wants_email + email_address). RESEND_API_KEY is intentionally NOT a
 * required env var (see lib/env.ts) — most deployments won't have email
 * configured, and the app must keep working WhatsApp-only if it's absent.
 *
 * `theme` is a parameter rather than fetched in here on purpose: the caller
 * (the daily-push cron) sends one email per active participant in a loop,
 * and the theme is the same system_config row for all of them — fetching
 * it once outside the loop avoids N redundant Supabase round trips.
 */
export async function sendCurriculumEmail(params: {
  to: string;
  dayTitle: string;
  dayText: string;
  theme: EmailTheme;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set — skipping curriculum email to", params.to);
    return { ok: false, skipped: true, error: "RESEND_API_KEY not configured" };
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "30 Days on the Mount <onboarding@30daysonthemount.com>";
  const html = buildCurriculumEmailHtml(params.theme, params.dayTitle, params.dayText);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.dayTitle,
        text: params.dayText,
        html,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Resend email send failed:", { status: response.status, error: payload });
      return { ok: false, skipped: false, error: payload?.message ?? `Resend responded with status ${response.status}` };
    }

    return { ok: true, skipped: false, error: null };
  } catch (error) {
    console.error("Resend email request threw:", error);
    const message = error instanceof Error ? error.message : "Unknown Resend error";
    return { ok: false, skipped: false, error: message };
  }
}
