"use client";

import Link from "next/link";
import { useState } from "react";
import { X, MoreHorizontal, Volume2, VolumeX } from "lucide-react";

/**
 * Universal top overlay for the GuidedStory — floats above all slides and
 * stays fixed as the participant swipes vertically. Left: close (X) back to
 * the JourneyStack. Right: ambient-audio mute toggle + options (⋯). The
 * wrapper is pointer-events-none so it never intercepts the vertical scroll;
 * only the buttons opt back in.
 */
export function TopOverlay({
  muted,
  onToggleMute,
  onOpenCommunity,
}: {
  muted: boolean;
  onToggleMute: () => void;
  onOpenCommunity: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-4">
      <Link
        href="/journey"
        aria-label="Close"
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-zoe-ink backdrop-blur-md transition-colors hover:bg-black/50"
      >
        <X className="h-5 w-5" />
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={muted ? "Unmute ambient sound" : "Mute ambient sound"}
          onClick={onToggleMute}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-zoe-ink backdrop-blur-md transition-colors hover:bg-black/50"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <div className="pointer-events-auto relative">
          <button
            type="button"
            aria-label="Options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-zoe-ink backdrop-blur-md transition-colors hover:bg-black/50"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-12 w-52 overflow-hidden rounded-xl border border-white/10 bg-black/70 backdrop-blur-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenCommunity();
                }}
                className="block w-full px-4 py-3 text-left text-sm text-zoe-ink transition-colors hover:bg-white/10"
              >
                Community Reflections
              </button>
              <Link href="/journey" className="block px-4 py-3 text-sm text-zoe-ink transition-colors hover:bg-white/10">
                Back to the mountain
              </Link>
              {/* Future: restart day, audio settings, sign out. */}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
