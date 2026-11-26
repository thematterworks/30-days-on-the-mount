import type { Metadata } from "next";
import Link from "next/link";
import { MountainMark, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { SitePage } from "@/components/site/SitePage";

export const metadata: Metadata = { title: "Thank you — 30 Days on the Mount", robots: { index: false } };

/** Where Stripe returns a giver. A receipt comes from Stripe by email. */
export default function ThanksPage() {
  return (
    <SitePage>
      <div className="relative overflow-x-clip">
        <div className="site-light" aria-hidden />
        <SiteHeader />
        <main className="relative z-10 mx-auto flex min-h-[70svh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <MountainMark width={140} className="site-mountain-draw" />
          <h1 className="site-display site-rise mt-10 text-5xl" style={{ animationDelay: "0.8s" }}>Thank you</h1>
          <p className="site-serif site-rise mt-6 text-lg leading-relaxed text-white/85" style={{ animationDelay: "1s" }}>
            Because of you, someone else can begin the journey for free. A receipt is on its way to your email.
          </p>
          <p className="site-serif site-rise mt-4 italic text-white/70" style={{ animationDelay: "1.2s" }}>
            &ldquo;Give, and it will be given to you.&rdquo; Luke 6:38
          </p>
          <Link href="/" className="site-button site-button-quiet site-rise mt-10" style={{ animationDelay: "1.4s" }}>
            Back to the mountain
          </Link>
        </main>
        <SiteFooter />
      </div>
    </SitePage>
  );
}
