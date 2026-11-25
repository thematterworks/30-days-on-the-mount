import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { badRequest, readJson } from "@/lib/mobile";
import { accountKey, canonicalEmail, isEmailSignInConfigured, issueSignInCode, sendSignInCodeEmail } from "@/lib/mobile-accounts";

/**
 * Emails a one-time sign-in code. Like the texted code, the response is the
 * same whether or not the address belongs to anyone.
 */
export async function POST(request: NextRequest) {
  if (!isEmailSignInConfigured()) {
    return NextResponse.json({ error: "Email sign-in isn't available yet." }, { status: 503 });
  }
  const email = canonicalEmail((await readJson(request)).email);
  if (!email) return badRequest("Enter your email address.");

  const issued = await issueSignInCode(accountKey("email", email));
  if ("response" in issued) return issued.response;

  if (!(await sendSignInCodeEmail(email, issued.code))) {
    return NextResponse.json({ error: "We couldn't email that address. Check it and try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
