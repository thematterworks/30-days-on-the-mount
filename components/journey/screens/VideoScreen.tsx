"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import type { ScreenProps } from "../types";

/**
 * Screen 3 — The Teaching Video. A full-bleed vertical (9:16) video slide,
 * letterboxed cleanly on black. Custom tap-to-play (no native chrome).
 *
 * Audio physics: when the teaching video plays it reports up via
 * onVideoPlayingChange so the shell ducks the ambient bed; when it pauses,
 * ends, or the participant swipes away (active -> false, which pauses the
 * video here), the bed resumes.
 */
export function VideoScreen({ day, active, onVideoPlayingChange }: ScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const url = day.teaching_video_url.trim();

  // Swiping away from this slide pauses the video (its onPause then resumes
  // the ambient bed). Only calls the DOM API here — no setState in the
  // effect body; state updates flow through the video's own event handlers.
  useEffect(() => {
    if (!active && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [active]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black px-8">
        <p className="text-center font-serif text-xl italic text-zoe-ink-muted">
          Today&apos;s teaching video is being prepared.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        src={url}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          onVideoPlayingChange?.(true);
        }}
        onPause={() => {
          setPlaying(false);
          onVideoPlayingChange?.(false);
        }}
        onEnded={() => {
          setPlaying(false);
          onVideoPlayingChange?.(false);
        }}
        className="h-full w-full object-contain"
      />

      {/* Custom play affordance — shown whenever paused. */}
      {!playing ? (
        <button
          type="button"
          aria-label="Play teaching video"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 text-zoe-ink backdrop-blur-md">
            <Play className="h-6 w-6 translate-x-0.5" />
          </span>
        </button>
      ) : (
        // While playing, a small quiet pause control top-center-free zone —
        // tapping the video itself also pauses.
        <button
          type="button"
          aria-label="Pause teaching video"
          onClick={togglePlay}
          className="absolute bottom-6 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-black/30 text-zoe-ink/80 backdrop-blur-md"
        >
          <Pause className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
