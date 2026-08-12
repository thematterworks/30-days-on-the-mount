import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getEmailTheme, updateEmailTheme } from "@/lib/system-config";
import type { EmailTheme } from "@/lib/email-template";

const THEME_FIELDS: (keyof EmailTheme)[] = [
  "background_gradient",
  "primary_accent_color",
  "secondary_accent_color",
  "main_font_family",
  "alt_font_family",
  "body_text_color",
  "header_mountain_image_url",
  "title_font_size",
  "subtext_font_size",
  "body_font_size",
  "line_height",
];

export async function GET() {
  const theme = await getEmailTheme();
  return NextResponse.json({ theme });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Partial<EmailTheme> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  for (const field of THEME_FIELDS) {
    if (body[field] !== undefined && typeof body[field] !== "string") {
      return NextResponse.json({ error: `${field} must be a string` }, { status: 400 });
    }
  }

  // Merge over the current value rather than trusting the client to send a
  // complete object — keeps unset fields intact if the UI is ever updated
  // to only send a diff.
  const current = await getEmailTheme();
  const merged: EmailTheme = { ...current, ...body };
  await updateEmailTheme(merged);

  return NextResponse.json({ theme: merged });
}
