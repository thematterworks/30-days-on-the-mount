"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ScreenProps } from "../types";

type Phase = "writing" | "thinking" | "question";

/**
 * Screen 4 — The Curious Inspector, as a full-screen slide. A radically
 * simple, distraction-free journaling space: just a cursor and the
 * participant's thoughts, centered, no visible form chrome. On submit, the
 * AI's single piercing question replaces the input (rather than threading
 * like a chat), keeping the "one thing at a time" feel.
 *
 * No autoFocus — in a vertical snap container, autofocusing a lower slide
 * would yank the scroll position to it on mount. The participant taps in
 * when they arrive.
 */
export function ReflectionScreen({ day }: ScreenProps) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("writing");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shareToCommunity, setShareToCommunity] = useState(false);

  async function submit() {
    const reflection = text.trim();
    if (!reflection || phase !== "writing") return;
    setPhase("thinking");
    setError(null);

    try {
      const response = await fetch("/api/journey/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayNumber: day.day_number, reflection }),
      });
      const data = (await response.json().catch(() => null)) as { question?: string; error?: string } | null;
      if (!response.ok || !data?.question) {
        throw new Error(data?.error ?? "The Inspector is quiet right now.");
      }
      setQuestion(data.question);
      setPhase("question");

      // If opted in, also post this reflection to the day's community wall,
      // anonymously. Best-effort and non-blocking — a failure here must not
      // disrupt the reflection experience the participant just completed.
      if (shareToCommunity) {
        void fetch(`/api/journey/community/${day.day_number}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reflection_text: reflection, anonymous: true }),
        }).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something interrupted the silence.");
      setPhase("writing");
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#26283f] to-zoe-deep px-8">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <AnimatePresence mode="wait">
          {phase === "writing" && (
            <motion.div key="writing" exit={{ opacity: 0 }} className="w-full">
              <p className="mb-8 font-mono text-[0.6rem] uppercase tracking-[0.3em] text-zoe-gold">
                The Curious Inspector
              </p>
              <textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What came up when you tried this today?"
                className="w-full resize-none border-none bg-transparent text-center font-sans text-lg text-zoe-ink placeholder:text-zoe-ink-muted focus:outline-none"
              />
              {error ? <p className="mt-4 text-sm text-zoe-ink-muted">{error}</p> : null}
              <AnimatePresence>
                {text.trim().length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-10 flex flex-col items-center gap-5"
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zoe-ink-muted">
                      <input
                        type="checkbox"
                        checked={shareToCommunity}
                        onChange={(e) => setShareToCommunity(e.target.checked)}
                        className="h-4 w-4 accent-zoe-gold"
                      />
                      Share reflection anonymously with the community
                    </label>
                    <button
                      type="button"
                      onClick={submit}
                      className="font-serif text-sm italic tracking-wide text-zoe-gold"
                    >
                      Offer this
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {phase === "thinking" && (
            <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="h-2 w-2 animate-pulse rounded-full bg-zoe-gold" />
            </motion.div>
          )}

          {phase === "question" && (
            <motion.div key="question" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full">
              <p className="font-serif text-2xl italic leading-relaxed text-zoe-ink">{question}</p>
              <p className="mt-8 font-mono text-[0.6rem] uppercase tracking-[0.3em] text-zoe-ink-muted">
                Sit with it. Then keep going.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
