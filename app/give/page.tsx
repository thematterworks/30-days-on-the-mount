import type { Metadata } from "next";
import { MountainMark, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { SitePage } from "@/components/site/SitePage";
import { GiftForm } from "./GiftForm";

export const metadata: Metadata = {
  title: "Keep the mountain open — 30 Days on the Mount",
  description: "30 Days on the Mount is free, with no ads. A gift helps keep it free for the next person who needs it.",
};

/** The giving page: why gifts matter, and a simple way to give. */
export default async function GivePage({ searchParams }: PageProps<"/give">) {
  const from = (await searchParams).from;
  const source = typeof from === "string" ? from.slice(0, 20) : "web";
  return (
    <SitePage>
      <div className="relative overflow-x-clip">
        <div className="site-light" aria-hidden />
        <SiteHeader />
        <main className="relative z-10 mx-auto max-w-2xl px-6 pb-10 pt-12 text-center">
          <MountainMark width={150} className="site-rise mx-auto" />
          <p className="site-eyebrow site-rise mt-10" style={{ animationDelay: "0.2s" }}>Free, with no ads</p>
          <h1 className="site-display site-rise mt-5 text-5xl leading-tight sm:text-6xl" style={{ animationDelay: "0.35s" }}>
            Keep the mountain open
          </h1>
          <p className="site-serif site-rise mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/85" style={{ animationDelay: "0.5s" }}>
            30 Days on the Mount is free for everyone. If these mornings have meant something to you, a gift helps keep the
            companion, the music and every day of the journey free for the next person who needs it.
          </p>
          <div className="site-rise" style={{ animationDelay: "0.65s" }}>
            <GiftForm source={source} />
          </div>
        </main>
        <SiteFooter />
      </div>
    </SitePage>
  );
}
