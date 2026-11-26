import "server-only";

// Gifts that keep 30 Days on the Mount free: one-time or monthly, paid on
// the website through Stripe Checkout, so no app store takes a share. The
// app links here only on the US App Store, where linking out to a web
// payment is allowed (App Review Guideline 3.1.1(a)).
//
// These are gifts to The Matterworks LLC, not charitable donations: never
// call them tax-deductible.
//
// Needs STRIPE_SECRET_KEY: a restricted key with write access to Checkout
// Sessions is enough.

export const GIFT_AMOUNTS = [500, 1500, 3000, 5000];
const MIN_CENTS = 300;
const MAX_CENTS = 100_000;

export function isGivingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function validGiftAmount(cents: unknown): cents is number {
  return typeof cents === "number" && Number.isInteger(cents) && cents >= MIN_CENTS && cents <= MAX_CENTS;
}

/** A Stripe Checkout page for one gift; returns its URL. */
export async function giftCheckoutURL(params: { cents: number; monthly: boolean; origin: string; source: string }): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Giving isn't set up yet.");

  const form = new URLSearchParams();
  form.set("mode", params.monthly ? "subscription" : "payment");
  form.set("success_url", `${params.origin}/give/thanks?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${params.origin}/give`);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(params.cents));
  form.set("line_items[0][price_data][product_data][name]", params.monthly ? "A monthly gift to 30 Days on the Mount" : "A gift to 30 Days on the Mount");
  form.set("line_items[0][price_data][product_data][description]", "Keeping the journey free, with no ads, for the next person who needs it.");
  if (params.monthly) form.set("line_items[0][price_data][recurring][interval]", "month");
  else form.set("submit_type", "pay");
  form.set("metadata[source]", params.source);
  form.set("allow_promotion_codes", "false");
  form.set("billing_address_collection", "auto");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const body = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !body.url) {
    console.error("Stripe checkout failed", body.error?.message);
    throw new Error("The gift page couldn't be opened just now.");
  }
  return body.url;
}
