import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link expired — 30 Days on the Mount",
  robots: { index: false },
};

/**
 * Landing for a missing / expired / already-used magic link. Kept minimal
 * here; the "text me a fresh link" action is wired in a later increment
 * (it needs a small mint+send endpoint). For now it points people back to
 * their daily text, which always contains a current link.
 */
export default function ExpiredLinkPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-[#4A4E7E] to-[#313554] px-6 text-center text-white">
      <div className="max-w-sm">
        <h1 className="font-serif text-3xl">This door has closed</h1>
        <p className="mt-4 text-base text-white/70">
          That link has expired or was already used. Each day&apos;s message carries a fresh one — open your most
          recent text from 30 Days on the Mount to step back in.
        </p>
      </div>
    </div>
  );
}
