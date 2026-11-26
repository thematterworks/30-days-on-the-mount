import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/giving";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Stripe's events for gifts (lib/giving.ts), signature-checked, recorded in
// gifts and monthly_givers. Subscribed events in the Stripe Dashboard:
//   checkout.session.completed, checkout.session.async_payment_succeeded,
//   checkout.session.async_payment_failed, invoice.paid,
//   invoice.payment_failed, customer.subscription.updated,
//   customer.subscription.deleted, charge.refunded, charge.dispute.created,
//   radar.early_fraud_warning.created

const id = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : value?.id ?? null);

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.error("Stripe webhook signature failed", error);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  try {
    await handle(event);
  } catch (error) {
    // A non-2xx makes Stripe retry later.
    console.error(`Stripe webhook ${event.type} failed`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  const supabase = getSupabaseAdmin();
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      const email = session.customer_details?.email ?? null;
      if (session.mode === "subscription") {
        // The monthly giver; each month's payment arrives as invoice.paid.
        const subscription = id(session.subscription);
        if (subscription) {
          await supabase.from("monthly_givers").upsert(
            { stripe_subscription: subscription, stripe_customer: id(session.customer), email, amount_cents: session.amount_total, status: "active" },
            { onConflict: "stripe_subscription" },
          );
        }
        return;
      }
      const status =
        event.type === "checkout.session.async_payment_failed" ? "failed" : session.payment_status === "unpaid" ? "pending" : "paid";
      await supabase.from("gifts").upsert(
        {
          kind: "once",
          amount_cents: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          email,
          source: session.metadata?.source ?? null,
          status,
          stripe_customer: id(session.customer),
          stripe_checkout_session: session.id,
          stripe_payment_intent: id(session.payment_intent),
        },
        { onConflict: "stripe_checkout_session" },
      );
      return;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      const subscription = id(invoice.parent?.subscription_details?.subscription);
      if (!subscription) return;
      const payment = invoice.payments?.data?.[0]?.payment;
      await supabase.from("gifts").upsert(
        {
          kind: "monthly",
          amount_cents: invoice.amount_paid,
          currency: invoice.currency,
          email: invoice.customer_email,
          source: invoice.parent?.subscription_details?.metadata?.source ?? null,
          status: "paid",
          stripe_customer: id(invoice.customer),
          stripe_invoice: invoice.id,
          stripe_subscription: subscription,
          stripe_payment_intent: payment?.type === "payment_intent" ? id(payment.payment_intent) : null,
        },
        { onConflict: "stripe_invoice" },
      );
      return;
    }

    case "invoice.payment_failed": {
      // Stripe retries and emails the giver (Smart Retries); note it here.
      const invoice = event.data.object;
      console.warn("Monthly gift payment failed", invoice.id, invoice.customer_email);
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await supabase
        .from("monthly_givers")
        .update({
          status: subscription.status,
          ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null,
        })
        .eq("stripe_subscription", subscription.id);
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object;
      const intent = id(charge.payment_intent);
      if (intent && charge.refunded) await supabase.from("gifts").update({ status: "refunded" }).eq("stripe_payment_intent", intent);
      return;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object;
      const intent = id(dispute.payment_intent);
      if (intent) await supabase.from("gifts").update({ status: "disputed" }).eq("stripe_payment_intent", intent);
      console.warn("A gift was disputed", dispute.id);
      return;
    }

    case "radar.early_fraud_warning.created": {
      // Refunding before a dispute avoids the dispute fee; review in Stripe.
      console.warn("Early fraud warning on a gift", event.data.object.id);
      return;
    }

    default:
      return;
  }
}
