import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Opt-In — 30 Days on the Mount",
  description:
    "Opt in to the 30 Days on the Mount daily SMS by texting START or MOUNTAIN to +1 (323) 747-7471.",
};

/**
 * Dedicated, screenshot-ready SMS opt-in call-to-action page. Purpose-built
 * as A2P 10DLC / TCR "call-to-action" evidence: one self-contained view with
 * every CTIA-mandated disclosure (program name + operator, keyword opt-in,
 * express consent, consent-not-a-condition, free, frequency, rates, HELP/STOP)
 * and links to Terms + Privacy. No nav, no admin link — a single capture
 * shows a reviewer everything.
 */
export default function OptInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-foreground">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          30 Days on the Mount · operated by The Matterworks LLC
        </p>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-card-foreground">
          Text <span className="text-primary">START</span> or <span className="text-primary">MOUNTAIN</span>
          <br />
          to{" "}
          <a href="sms:+13237477471" className="text-primary underline underline-offset-4">
            +1 (323) 747-7471
          </a>
        </h1>

        <p className="mt-6 text-base text-card-foreground">
          Opt in to receive a recurring daily text from 30 Days on the Mount — a short scriptural reflection from
          the Sermon on the Mount and a link to that day&apos;s guided practice.
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-border bg-background/40 p-5 text-left text-sm text-muted-foreground">
          <p>
            By texting in, you give your express consent to receive recurring automated text messages from 30 Days
            on the Mount. <strong className="text-card-foreground">Consent is not a condition of any purchase.</strong>{" "}
            The program is free to join.
          </p>
          <p>Message frequency varies. Message and data rates may apply.</p>
          <p>
            Reply <strong className="text-card-foreground">HELP</strong> for help or{" "}
            <strong className="text-card-foreground">STOP</strong> to cancel at any time.
          </p>
          <p>
            No mobile information is shared with third parties or affiliates for marketing or promotional purposes.
          </p>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          <a href="/terms" className="text-primary underline underline-offset-4">
            Terms of Service
          </a>{" "}
          ·{" "}
          <a href="/privacy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
