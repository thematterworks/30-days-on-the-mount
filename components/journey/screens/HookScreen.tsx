import { MediaFrame } from "../MediaFrame";
import type { ScreenProps } from "../types";

/** Screen 1 — The Hook & The Invitation, as a full-bleed media slide. A
 *  single provocative line or the disruptive action, over full-bleed media
 *  (or the Zoe gradient). Falls back to the day title if unauthored. */
export function HookScreen({ day }: ScreenProps) {
  const hook = day.hook_text.trim() || day.title;

  return (
    <MediaFrame dayNumber={day.day_number} title={day.title} backgroundUrl={day.media_url}>
      <h1 className="max-w-md font-serif text-4xl leading-tight text-zoe-ink drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
        {hook}
      </h1>
    </MediaFrame>
  );
}
