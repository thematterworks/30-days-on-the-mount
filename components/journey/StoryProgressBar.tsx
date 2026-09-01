/**
 * Instagram-story-style segmented progress bar — one segment per screen.
 * Filled (gold) up to and including the current screen, quiet otherwise.
 * The single gold accent is the only bright thing on the chrome, by design.
 */
export function StoryProgressBar({ total, current }: { total: number; current: number }) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex gap-1.5 px-4 pt-4">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-zoe-gold transition-all duration-300"
            style={{ width: i <= current ? "100%" : "0%" }}
          />
        </div>
      ))}
    </div>
  );
}
