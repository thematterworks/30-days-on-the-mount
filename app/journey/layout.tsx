import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./journey.css";

// Display serif for the sanctuary — day titles, scripture, the Hook. Its
// optical-sizing axis reads majestic at large sizes without feeling cold.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "30 Days on the Mount",
  // The whole PWA is private (magic-link gated); keep it out of search.
  robots: { index: false, follow: false },
};

/**
 * Layout for the premium /journey PWA — the "Secret Room." Deliberately
 * carries none of the admin chrome (no TooltipProvider sidebar, etc.). The
 * root app/layout.tsx still provides <html>/<body> (dark class, Geist
 * vars); here we just add the Fraunces variable and the Zoe stage.
 */
export default function JourneyLayout({ children }: LayoutProps<"/journey">) {
  return <div className={`${fraunces.variable} journey-root`}>{children}</div>;
}
