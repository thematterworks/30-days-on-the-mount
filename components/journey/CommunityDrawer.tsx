"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2 } from "lucide-react";

interface Reflection {
  id: string;
  day_number: number;
  display_name: string;
  reflection_text: string;
  created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * The Daily Community Reflection Wall — a bottom sheet that slides up over
 * the current story slide (the story stays mounted underneath, so audio and
 * scroll position are untouched). Participants browse what others shared for
 * this specific day and can add their own, anonymously by default.
 */
export function CommunityDrawer({
  dayNumber,
  open,
  onClose,
}: {
  dayNumber: number;
  open: boolean;
  onClose: () => void;
}) {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/journey/community/${dayNumber}`);
        const data = await response.json();
        if (!cancelled) setReflections(data.reflections ?? []);
      } catch {
        if (!cancelled) setError("Couldn't load reflections.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, dayNumber]);

  async function submit() {
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/journey/community/${dayNumber}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflection_text: value, anonymous }),
      });
      const data = (await response.json().catch(() => null)) as { reflection?: Reflection; error?: string } | null;
      if (!response.ok || !data?.reflection) {
        throw new Error(data?.error ?? "Couldn't share your reflection.");
      }
      setReflections((prev) => [data.reflection as Reflection, ...prev]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't share your reflection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-white/10 bg-[#1c1e30]/95 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <div className="mx-auto h-1 w-10 -translate-x-2 rounded-full bg-white/20" aria-hidden />
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-zoe-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 pb-2">
              <h2 className="font-serif text-2xl text-zoe-ink">Community Reflections</h2>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-zoe-gold">
                Day {String(dayNumber).padStart(2, "0")} · you&apos;re not climbing alone
              </p>
            </div>

            {/* List */}
            <div className="journey-scroll flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-zoe-ink-muted" />
                </div>
              ) : reflections.length === 0 ? (
                <p className="py-8 text-center font-serif text-lg italic text-zoe-ink-muted">
                  Be the first to share today.
                </p>
              ) : (
                reflections.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-white/[0.04] p-4">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="font-serif text-sm text-zoe-gold">{r.display_name}</span>
                      <span className="font-mono text-[0.6rem] text-zoe-ink/40">{relativeTime(r.created_at)}</span>
                    </div>
                    <p className="text-[0.95rem] leading-relaxed text-zoe-ink/85">{r.reflection_text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Compose */}
            <div className="border-t border-white/10 px-6 pb-8 pt-4">
              {error ? <p className="mb-2 text-xs text-zoe-ink-muted">{error}</p> : null}
              <textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share a reflection with today's climbers…"
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-sans text-[0.95rem] text-zoe-ink placeholder:text-zoe-ink-muted focus:border-zoe-gold/40 focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zoe-ink-muted">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="h-4 w-4 accent-zoe-gold"
                  />
                  Share anonymously
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !text.trim()}
                  className="rounded-full bg-zoe-gold px-6 py-2 font-serif text-sm text-zoe-deep transition-opacity disabled:opacity-40"
                >
                  {submitting ? "Sharing…" : "Share"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
