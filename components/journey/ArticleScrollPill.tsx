"use client";

import { motion } from "motion/react";

/**
 * Dynamic reading-progress capsule for the Exegesis article slide. A single
 * vertical pill whose gold fill grows and shrinks with the reader's scroll
 * position. Distinct from the shell's global 5-dot ProgressPill (story
 * position) — this one tracks position *within* the article.
 *
 * `progress` is 0..1 (fraction of the article scrolled).
 */
export function ArticleScrollPill({ progress }: { progress: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="pointer-events-none absolute bottom-8 right-5 z-20 flex flex-col items-center gap-2"
      aria-hidden
    >
      <div className="relative h-16 w-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className="absolute inset-x-0 top-0 rounded-full bg-zoe-gold transition-[height] duration-150 ease-out"
          style={{ height: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[0.6rem] tabular-nums text-zoe-ink/60">{pct}</span>
    </motion.div>
  );
}
