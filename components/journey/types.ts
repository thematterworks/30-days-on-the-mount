/** The per-day content the GuidedStory screens render. A serializable
 *  subset of CurriculumDayRow, passed from the day route server component
 *  into the client GuidedStory. */
export interface GuidedStoryDay {
  day_number: number;
  title: string;
  hook_text: string;
  scripture_reference: string;
  scripture_text: string;
  scripture_audio_url: string;
  teaching_video_url: string;
  exegesis_text: string;
  surrender_text: string;
  media_url: string | null;
}

export interface ScreenProps {
  day: GuidedStoryDay;
  /** Whether this screen is the currently snapped-into-view slide. Used by
   *  VideoScreen to pause playback when the participant swipes away. */
  active?: boolean;
  /** VideoScreen reports its play state so the shell can duck/resume the
   *  ambient audio bed. Ignored by other screens. */
  onVideoPlayingChange?: (playing: boolean) => void;
}
