import Link from "next/link";
import { Lock } from "lucide-react";

export type DayState = "completed" | "active" | "locked";

/**
 * A single day in the JourneyStack. Active and completed days are tappable
 * (they cross the threshold into that day's GuidedStory); locked future
 * days are present-but-muted so the participant sees the scale of the
 * mountain without being able to skip ahead.
 */
export function DayCard({
  dayNumber,
  title,
  state,
}: {
  dayNumber: number;
  title: string;
  state: DayState;
}) {
  const number = String(dayNumber).padStart(2, "0");

  const body = (
    <div
      className={[
        "flex aspect-[4/5] w-full flex-col justify-between rounded-3xl border p-8 transition-colors",
        state === "active"
          ? "border-zoe-gold/60 bg-white/[0.06] shadow-[0_0_60px_-15px_var(--color-zoe-gold)]"
          : state === "completed"
            ? "border-white/15 bg-white/[0.03]"
            : "border-zoe-locked bg-transparent",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span
          className={[
            "font-mono text-sm tracking-[0.3em]",
            state === "active" ? "text-zoe-gold" : "text-zoe-ink-muted",
          ].join(" ")}
        >
          {number} / 30
        </span>
        {state === "locked" ? <Lock className="h-4 w-4 text-zoe-ink-muted" /> : null}
      </div>

      <h2
        className={[
          "font-serif text-3xl leading-tight",
          state === "locked" ? "text-zoe-ink-muted" : "text-zoe-ink",
        ].join(" ")}
      >
        {title}
      </h2>

      <span className="font-serif text-sm italic text-zoe-ink-muted">
        {state === "active" ? "Enter today" : state === "completed" ? "Revisit" : "Not yet"}
      </span>
    </div>
  );

  if (state === "locked") {
    // Deliberately inert — no href, so future days can't be opened.
    return <div aria-disabled className="w-full select-none">{body}</div>;
  }

  return (
    <Link href={`/journey/day/${dayNumber}`} className="w-full">
      {body}
    </Link>
  );
}
