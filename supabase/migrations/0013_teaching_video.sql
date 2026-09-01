-- Teaching Video: a dedicated full-bleed video slide in the GuidedStory,
-- between Scripture and the Exegesis. One URL per day, authored in the admin
-- CMS. Empty by default so the screen renders a graceful placeholder.

alter table curriculum_days
  add column if not exists teaching_video_url text not null default '';

comment on column curriculum_days.teaching_video_url is
  'GuidedStory VideoScreen (premium PWA): URL of the day''s vertical (9:16) teaching video. Empty = no video, screen shows a placeholder.';
