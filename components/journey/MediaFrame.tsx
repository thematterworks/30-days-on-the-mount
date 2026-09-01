import { Mountain } from "lucide-react";
import { PlayBar } from "./PlayBar";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v", ".ogv"];
function isVideoUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Full-bleed, edge-to-edge media slide frame (short-form-video style) used
 * by the Hook and Scripture screens. Background is a looping muted video or
 * an image (from media_url) or the Zoe gradient; a bottom scrim keeps
 * overlaid text legible. Bottom-left carries the app avatar + day title,
 * with the audio scrub/play bar beneath it when the day has audio.
 */
export function MediaFrame({
  dayNumber,
  title,
  backgroundUrl,
  audioUrl,
  children,
}: {
  dayNumber: number;
  title: string;
  backgroundUrl: string | null;
  audioUrl?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Background layer */}
      <div className="absolute inset-0">
        {backgroundUrl && isVideoUrl(backgroundUrl) ? (
          <video
            src={backgroundUrl}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        ) : backgroundUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset from Supabase Storage
          <img src={backgroundUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-zoe-dusk to-zoe-deep" />
        )}
        {/* Legibility scrim — darker toward the bottom where the chrome sits */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />
      </div>

      {/* Centered content (hook line / scripture) */}
      <div className="relative z-10 flex h-full items-center justify-center px-8 pb-40 pt-20 text-center">
        {children}
      </div>

      {/* Bottom chrome: profile above the play bar */}
      <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 px-5 pb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-md">
            <Mountain className="h-4 w-4 text-zoe-gold" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-serif text-sm text-zoe-ink">{title}</p>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-zoe-ink/60">
              30 Days on the Mount · Day {String(dayNumber).padStart(2, "0")}
            </p>
          </div>
        </div>
        {audioUrl ? <PlayBar src={audioUrl} /> : null}
      </div>
    </div>
  );
}
