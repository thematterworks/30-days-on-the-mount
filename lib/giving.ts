import "server-only";
import Stripe from "stripe";

// Gifts that keep 30 Days on the Mount free: one-time or monthly, paid on
// the website through Stripe Checkout, so no app store takes a share. The
// app links here only on the US App Store, where linking out to a web
// payment is allowed (App Review Guideline 3.1.1(a)).
//
// These are gifts to The Matterworks LLC, not charitable donations: never
// call them tax-deductible.
//
// Configure in Vercel as sensitive environment variables:
//   STRIPE_SECRET_KEY      a restricted key (rk_…) with write access to
//                          Checkout Sessions, and nothing else
//   STRIPE_WEBHOOK_SECRET  the signing secret (whsec_…) of the webhook
//                          endpoint at /api/stripe/webhook

export const GIFT_AMOUNTS = [500, 1500, 3000, 5000];
const MIN_CENTS = 300;
const MAX_CENTS = 100_000;
/** Tags these sessions in the Stripe Dashboard. */
const INTEGRATION_IDENTIFIER = "give_web_qmzrtkwa";

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Giving isn't set up yet.");
  client ??= new Stripe(key);
  return client;
}

export function isGivingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function validGiftAmount(cents: unknown): cents is number {
  return typeof cents === "number" && Number.isInteger(cents) && cents >= MIN_CENTS && cents <= MAX_CENTS;
}

/** A Stripe Checkout page for one gift; returns its URL. */
export async function giftCheckoutURL(params: { cents: number; monthly: boolean; origin: string; source: string }): Promise<string> {
  const name = params.monthly ? "A monthly gift to 30 Days on the Mount" : "A gift to 30 Days on the Mount";
  const session = await stripe().checkout.sessions.create({
    mode: params.monthly ? "subscription" : "payment",
    success_url: `${params.origin}/give/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.origin}/give`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: params.cents,
          product_data: { name, description: "Keeping the journey free, with no ads, for the next person who needs it." },
          ...(params.monthly ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    ...(params.monthly ? {} : { submit_type: "pay" as const, customer_creation: "always" as const }),
    metadata: { source: params.source },
    // Managed Payments (Stripe as seller of record, on by default for this
    // account) is for selling digital goods and requires a tax code; a gift
    // isn't a sale.
    managed_payments: { enabled: false },
    ...(params.monthly ? { subscription_data: { metadata: { source: params.source } } } : {}),
    integration_identifier: INTEGRATION_IDENTIFIER,
  } as Stripe.Checkout.SessionCreateParams);
  if (!session.url) throw new Error("The gift page couldn't be opened just now.");
  return session.url;
}
