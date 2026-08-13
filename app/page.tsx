import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "30 Days on the Mount",
  description:
    "A 30-day guided reflection practice through the Sermon on the Mount, delivered daily by WhatsApp or text message.",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-24 text-foreground">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">30 Days on the Mount</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A 30-day guided reflection practice through the Sermon on the Mount — one daily invitation at a time,
          delivered straight to your phone.
        </p>

        <div className="mt-10 rounded-lg border border-border bg-card p-6 text-left">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Join by text message
          </h2>
          <p className="mt-2 text-base text-card-foreground">
            Prefer text? Text <strong>START</strong> to{" "}
            <a href="sms:+13237477471" className="text-primary underline underline-offset-4">
              +1 (323) 747-7471
            </a>{" "}
            to join directly. Message and data rates may apply. Reply <strong>STOP</strong> at any time to
            unsubscribe, or <strong>HELP</strong> for assistance.
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
