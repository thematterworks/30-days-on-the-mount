"use client";

import { useEffect, useRef, useState } from "react";
import { TopOverlay } from "./TopOverlay";
import { ProgressPill } from "./ProgressPill";
import { CommunityDrawer } from "./CommunityDrawer";
import { HookScreen } from "./screens/HookScreen";
import { ScriptureScreen } from "./screens/ScriptureScreen";
import { VideoScreen } from "./screens/VideoScreen";
import { ExegesisScreen } from "./screens/ExegesisScreen";
import { ReflectionScreen } from "./screens/ReflectionScreen";
import { SurrenderScreen } from "./screens/SurrenderScreen";
import type { GuidedStoryDay } from "./types";

const SCREENS = [HookScreen, ScriptureScreen, VideoScreen, ExegesisScreen, ReflectionScreen, SurrenderScreen] as const;

/** The article slide, on which the global dot pill is hidden in favor of
 *  ExegesisScreen's own dynamic scroll-tracking capsule. Index 3 now that
 *  the Teaching Video sits at index 2. */
const EXEGESIS_INDEX = 3;

/** How long the pill lingers before fading on non-article slides. */
const PILL_LINGER_MS = 2500;

/**
 * Ambient sanctuary track (looping bed). Swap this URL to change the
 * atmosphere; when empty, no <audio> mounts and playback is a no-op.
 */
const AMBIENT_AUDIO_URL =
  "https://abhbwguyrpjgqbyhomll.supabase.co/storage/v1/object/public/audio/Weightless_Stillness_2026-06-01T180237.mp3";

/**
 * The daily guided experience as a vertical, tactile snap-scroll (TikTok /
 * Reels / new YouVersion style): five full-screen slides in a
 * snap-y snap-mandatory column; swipe UP to pull the next in. Two ambient
 * layers sit above the (unchanged) snap physics: a global segmented
 * progress pill, and a looping sanctuary audio bed started on first touch.
 */
export function GuidedStory({ day }: { day: GuidedStoryDay }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const startedRef = useRef(false);
  const activeIndexRef = useRef(-1);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambientDuckedRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [pillVisible, setPillVisible] = useState(true);
  const [muted, setMuted] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);

  // Track the active slide as it snaps into view, and drive the pill from
  // here (an event subscription, not an effect body): fade the pill in on
  // each new slide, then auto-fade after a beat on media / static slides —
  // but keep it persistently visible on the article.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const idx = sectionRefs.current.indexOf(entry.target as HTMLElement);
          if (idx === -1 || idx === activeIndexRef.current) continue;

          activeIndexRef.current = idx;
          setActiveIndex(idx);
          if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
          if (idx === EXEGESIS_INDEX) {
            // The article slide hides the global dot pill entirely and shows
            // its own scroll-tracking capsule instead (see ExegesisScreen).
            setPillVisible(false);
          } else {
            setPillVisible(true);
            fadeTimerRef.current = setTimeout(() => setPillVisible(false), PILL_LINGER_MS);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => {
      observer.disconnect();
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  // Keep the ambient bed subtle.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = 0.35;
  }, []);

  // Mobile autoplay policies require a user gesture — start the bed on the
  // participant's very first touch/swipe inside the story.
  function startAmbient() {
    if (startedRef.current) return;
    const audio = audioRef.current;
    if (!audio || !AMBIENT_AUDIO_URL) return;
    startedRef.current = true;
    audio.muted = muted;
    void audio.play().catch(() => {});
  }

  function toggleMute() {
    startAmbient();
    setMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }

  // Duck the ambient bed under the teaching video: pause it while the video
  // plays, resume it (unless the user muted) when the video pauses, ends, or
  // the participant swipes away.
  function handleVideoPlayingChange(videoPlaying: boolean) {
    const audio = audioRef.current;
    if (!audio) return;
    if (videoPlaying) {
      if (!audio.paused) {
        audio.pause();
        ambientDuckedRef.current = true;
      }
    } else if (ambientDuckedRef.current) {
      ambientDuckedRef.current = false;
      if (!muted) void audio.play().catch(() => {});
    }
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden" onPointerDownCapture={startAmbient}>
      <TopOverlay muted={muted} onToggleMute={toggleMute} onOpenCommunity={() => setCommunityOpen(true)} />

      {AMBIENT_AUDIO_URL ? <audio ref={audioRef} src={AMBIENT_AUDIO_URL} loop preload="auto" /> : null}

      <div ref={containerRef} className="journey-scroll h-dvh w-full snap-y snap-mandatory overflow-y-scroll">
        {SCREENS.map((Screen, i) => (
          <section
            key={i}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
            className="h-dvh w-full snap-start snap-always overflow-hidden"
          >
            <Screen day={day} active={activeIndex === i} onVideoPlayingChange={handleVideoPlayingChange} />
          </section>
        ))}
      </div>

      <ProgressPill total={SCREENS.length} current={activeIndex} visible={pillVisible} />

      <CommunityDrawer dayNumber={day.day_number} open={communityOpen} onClose={() => setCommunityOpen(false)} />
    </div>
  );
}
