import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  MAX_CODES_PER_HOUR,
  SIGN_IN_CODE_TTL_SECONDS,
  badRequest,
  canonicalPhone,
  generateSignInCode,
  hashSignInCode,
  isReviewLogin,
  readJson,
} from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendSmsMessage } from "@/lib/twilio";

/**
 * Texts a one-time sign-in code. The response is the same whether or not the
 * number belongs to a participant, so the endpoint can't be used to discover
 * who is on the journey.
 */
export async function POST(request: NextRequest) {
  const phone = canonicalPhone((await readJson(request)).phoneNumber);
  if (!phone) return badRequest("Enter a mobile number, including the area code.");
  if (isReviewLogin(phone)) return NextResponse.json({ ok: true });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("sign_in_codes").select("*").eq("phone_number", phone).maybeSingle();

  // Sends are counted per rolling hour so the endpoint can't be used to
  // flood a number with texts.
  const now = Date.now();
  let sendsInWindow = 1;
  let windowStartedAt = new Date(now).toISOString();
  if (existing && now - Date.parse(existing.window_started_at) < 60 * 60 * 1000) {
    if (existing.sends_in_window >= MAX_CODES_PER_HOUR) {
      return NextResponse.json({ error: "Too many codes requested. Try again in an hour." }, { status: 429 });
    }
    sendsInWindow = existing.sends_in_window + 1;
    windowStartedAt = existing.window_started_at;
  }

  const code = generateSignInCode();
  const { error } = await supabase.from("sign_in_codes").upsert({
    phone_number: phone,
    code_hash: hashSignInCode(phone, code),
    expires_at: new Date(now + SIGN_IN_CODE_TTL_SECONDS * 1000).toISOString(),
    attempts: 0,
    sends_in_window: sendsInWindow,
    window_started_at: windowStartedAt,
  });
  if (error) {
    console.error("Could not store sign-in code", error);
    return NextResponse.json({ error: "Sign-in is unavailable right now. Please try again." }, { status: 500 });
  }

  // Code first, so iOS offers it as a one-tap autofill above the keyboard.
  const sent = await sendSmsMessage(phone, `${code} is your 30 Days on the Mount sign-in code. It expires in 10 minutes.`);
  if (!sent.ok) {
    return NextResponse.json({ error: "We couldn't text that number. Check it and try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
