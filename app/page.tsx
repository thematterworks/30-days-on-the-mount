import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "30 Days on the Mount",
  description:
    "A 30-day guided reflection practice through the Sermon on the Mount, delivered daily by text message.",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-24 text-foreground">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">30 Days on the Mount</h1>
        <p className="mt-1 text-sm text-muted-foreground">A messaging program operated by The Matterworks LLC</p>
        <p className="mt-4 text-lg text-muted-foreground">
          A 30-day guided reflection practice through the Sermon on the Mount — one daily invitation at a time,
          delivered straight to your phone.
        </p>

        <div className="mt-10 rounded-lg border border-border bg-card p-6 text-left">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Join by text message
          </h2>
          <p className="mt-2 text-base text-card-foreground">
            Text <strong>START</strong> or <strong>MOUNTAIN</strong> to{" "}
            <a href="sms:+13237477471" className="text-primary underline underline-offset-4">
              +1 (323) 747-7471
            </a>{" "}
            to opt in. You&apos;ll receive a recurring daily text from 30 Days on the Mount with a short scriptural
            reflection and a link to that day&apos;s guided practice.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            By texting in, you give your express consent to receive recurring automated messages from 30 Days on the
            Mount, operated by The Matterworks LLC. <strong>Consent is not a condition of any purchase.</strong> The
            program is free to join. Message
            frequency varies. Message and data rates may apply. Reply <strong>HELP</strong> for help or{" "}
            <strong>STOP</strong> to cancel at any time. See our{" "}
            <a href="/terms" className="underline underline-offset-4">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </a>
            .
          </p>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          By joining, you agree to our{" "}
          <a href="/terms" className="text-primary underline underline-offset-4">
            Terms and Conditions
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </a>
          .
        </p>

        <p className="mt-16 text-xs text-muted-foreground">
          <a href="/admin" className="underline underline-offset-4 hover:text-foreground">
            Admin login
          </a>
        </p>
      </div>
    </div>
  );
}
