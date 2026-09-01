"use client";

/**
 * Global story progress indicator: a vertical stack of dots, one per slide,
 * fixed in the GuidedStory shell's bottom-right corner. The active slide's
 * dot is elongated into a gold pill; the rest are small quiet circles.
 * Visibility (fade in on snap, auto-fade on media slides, persistent on the
 * article) is controlled by the shell via `visible`.
 */
export function ProgressPill({
  total,
  current,
  visible,
}: {
  total: number;
  current: number;
  visible: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute bottom-8 right-5 z-20 flex flex-col items-center gap-2 transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-full transition-all duration-300 ${
            i === current ? "h-4 bg-zoe-gold" : "h-1.5 bg-white/40"
          }`}
        />
      ))}
    </div>
  );
}
