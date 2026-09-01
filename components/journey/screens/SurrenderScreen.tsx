import Link from "next/link";
import type { ScreenProps } from "../types";

/** Screen 5 — The Surrender, as the final full-screen slide. A closing
 *  moment of guided prayer / somatic release that sends the participant back
 *  into the physical world to live the challenge. */
export function SurrenderScreen({ day }: ScreenProps) {
  const surrender =
    day.surrender_text.trim() || "Breathe. Loosen your grip. Carry today gently.";

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-zoe-deep to-black px-8">
      <div className="flex w-full max-w-md flex-col items-center gap-10 text-center">
        <p className="font-serif text-2xl italic leading-relaxed text-zoe-ink">{surrender}</p>
        <Link
          href="/journey"
          className="font-mono text-xs uppercase tracking-[0.3em] text-zoe-gold underline underline-offset-8"
        >
          Step back into the world
        </Link>
      </div>
    </div>
  );
}
