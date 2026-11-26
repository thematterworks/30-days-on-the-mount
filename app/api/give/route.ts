import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { giftCheckoutURL, isGivingConfigured, validGiftAmount } from "@/lib/giving";
import { SITE } from "@/lib/invites";

/** Starts a gift: { cents, monthly, source } → { url } of a Stripe Checkout page. */
export async function POST(request: NextRequest) {
  if (!isGivingConfigured()) return NextResponse.json({ error: "Giving isn't open just yet." }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { cents?: unknown; monthly?: unknown; source?: unknown };
  if (!validGiftAmount(body.cents)) return NextResponse.json({ error: "Choose an amount between $3 and $1,000." }, { status: 400 });
  const source = typeof body.source === "string" ? body.source.slice(0, 20) : "web";
  try {
    const url = await giftCheckoutURL({ cents: body.cents, monthly: body.monthly === true, origin: SITE, source });
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: 502 });
  }
}
