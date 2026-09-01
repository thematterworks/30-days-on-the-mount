import { MediaFrame } from "../MediaFrame";
import type { ScreenProps } from "../types";

/** Screen 2 — The Scripture, as a full-bleed media slide. The focal verse in
 *  large type, with the optional Lectio Divina audio driving the bottom
 *  play/scrub bar (via MediaFrame). */
export function ScriptureScreen({ day }: ScreenProps) {
  const verse = day.scripture_text.trim();
  const audioUrl = day.scripture_audio_url.trim() || undefined;

  return (
    <MediaFrame
      dayNumber={day.day_number}
      title={day.title}
      backgroundUrl={day.media_url}
      audioUrl={audioUrl}
    >
      <div className="max-w-md space-y-6">
        {verse ? (
          <blockquote className="font-serif text-2xl italic leading-relaxed text-zoe-ink drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
            &ldquo;{verse}&rdquo;
          </blockquote>
        ) : (
          <p className="font-serif text-xl italic text-zoe-ink-muted">Scripture for this day is being prepared.</p>
        )}
        {day.scripture_reference.trim() ? (
          <cite className="font-mono text-xs uppercase not-italic tracking-[0.3em] text-zoe-gold">
            {day.scripture_reference}
          </cite>
        ) : null}
      </div>
    </MediaFrame>
  );
}
