"use client";

import { useRef, useState } from "react";
import { ArticleScrollPill } from "../ArticleScrollPill";
import type { ScreenProps } from "../types";

/**
 * Screen 3 — The Exegesis. A premium reading slide: rich dark ground, large
 * serif title, legible sans body with generous leading and spacious
 * paragraph margins. The article scrolls within the slide; on mobile,
 * scrolling past the bottom chains into the next snap slide (the Curious
 * Inspector).
 *
 * The shell hides its global dot pill on this slide; instead, a dynamic
 * ArticleScrollPill tracks reading position within the article.
 */
export function ExegesisScreen({ day }: ScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const paragraphs = day.exegesis_text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    setProgress(scrollable <= 0 ? 1 : el.scrollTop / scrollable);
  }

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-zoe-deep to-[#26283f]">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        // Inner scroll for the article. overscroll-auto lets a scroll past
        // the end chain to the outer snap container -> next slide.
        className="journey-scroll h-full overflow-y-auto overscroll-auto px-7 pb-28 pt-24 [overscroll-behavior:auto]"
      >
        <div className="mx-auto max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-zoe-gold">
            Day {String(day.day_number).padStart(2, "0")}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-zoe-ink">{day.title}</h1>

          {paragraphs.length > 0 ? (
            <div className="mt-8 space-y-6 font-sans text-[1.075rem] leading-relaxed text-zoe-ink/85">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <p className="mt-8 font-serif text-xl italic text-zoe-ink-muted">
              Today&apos;s teaching is being prepared.
            </p>
          )}

          <p className="mt-16 text-center font-mono text-[0.6rem] uppercase tracking-[0.3em] text-zoe-ink/40">
            Keep scrolling
          </p>
        </div>
      </div>

      <ArticleScrollPill progress={progress} />
    </div>
  );
}
