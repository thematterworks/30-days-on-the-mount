import { NextResponse } from "next/server";
import { isEmailSignInConfigured } from "@/lib/mobile-accounts";

/** Which ways in the sign-in screen offers. Phone and Apple always; email once it can send. */
export async function GET() {
  return NextResponse.json({ phone: true, apple: true, email: isEmailSignInConfigured() });
}
