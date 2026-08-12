// Deliberately NOT "server-only" — this is a pure string-templating module
// (no I/O, no secrets) shared by lib/email.ts (server, actual sending) and
// the admin Email Design panel (client, live preview), so the preview is
// guaranteed to render exactly what gets sent. Anything with real I/O
// (fetching the theme from Supabase, calling Resend) stays out of here.

export interface EmailTheme {
  background_gradient: string;
  primary_accent_color: string;
  secondary_accent_color: string;
  main_font_family: string;
  alt_font_family: string;
  body_text_color: string;
  header_mountain_image_url: string;
  title_font_size: string;
  subtext_font_size: string;
  body_font_size: string;
  line_height: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Converts newline-separated curriculum text into paragraph tags. */
function paragraphsFromText(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 16px 0;">${escapeHtml(line)}</p>`)
    .join("\n");
}

/**
 * Builds the full daily curriculum email as a self-contained HTML document
 * with inline styles (required for reliable rendering across email
 * clients — Gmail and others strip <style> blocks in many contexts).
 * Structure mirrors the reference design: gradient background, optional
 * mountain header image, caps brand subtext, day title in the primary
 * accent, body content, footer in the secondary accent.
 */
export function buildCurriculumEmailHtml(theme: EmailTheme, dayTitle: string, dayText: string): string {
  const mountainImage = theme.header_mountain_image_url
    ? `<img src="${escapeHtml(theme.header_mountain_image_url)}" alt="" width="200" style="display:block;margin:0 auto 24px auto;max-width:200px;height:auto;border:0;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(dayTitle)}</title>
  </head>
  <body style="margin:0;padding:0;background:${theme.background_gradient};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.background_gradient};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding-bottom:8px;">${mountainImage}</td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:12px;">
                <p style="margin:0;font-family:${theme.alt_font_family};color:${theme.secondary_accent_color};font-size:${theme.subtext_font_size};letter-spacing:2px;text-transform:uppercase;">
                  30 Days on the Mount
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <h1 style="margin:0;font-family:${theme.main_font_family};color:${theme.primary_accent_color};font-size:${theme.title_font_size};font-weight:normal;line-height:${theme.line_height};">
                  ${escapeHtml(dayTitle)}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="font-family:${theme.main_font_family};color:${theme.body_text_color};font-size:${theme.body_font_size};line-height:${theme.line_height};padding-bottom:32px;">
                ${paragraphsFromText(dayText)}
              </td>
            </tr>
            <tr>
              <td align="center" style="border-top:1px solid rgba(255,255,255,0.2);padding-top:16px;">
                <p style="margin:0;font-family:${theme.alt_font_family};color:${theme.secondary_accent_color};font-size:${theme.subtext_font_size};letter-spacing:1px;text-transform:uppercase;opacity:0.8;">
                  30daysonthemount.com
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
