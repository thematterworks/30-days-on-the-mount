-- Structured per-day content for the /journey PWA's GuidedStory (the
-- tap-to-advance 5-screen experience). The existing curriculum_days columns
-- drive the text/WhatsApp track (title, fallback_text = the SMS teaching,
-- ai_guidance_prompt, evening_prompt_text); these six add the distinct
-- content each GuidedStory screen needs. All default '' so the screens can
-- render graceful fallbacks (e.g. Hook -> title) before content is authored.

alter table curriculum_days
  add column if not exists hook_text text not null default '',
  add column if not exists scripture_reference text not null default '',
  add column if not exists scripture_text text not null default '',
  add column if not exists scripture_audio_url text not null default '',
  add column if not exists exegesis_text text not null default '',
  add column if not exists surrender_text text not null default '';

comment on column curriculum_days.hook_text is
  'Screen 1 (Hook & Invitation): the single provocative question or the exact disruptive action for the day. Falls back to title if empty.';
comment on column curriculum_days.scripture_reference is
  'Screen 2 (Scripture): the verse citation, e.g. "Matthew 5:3".';
comment on column curriculum_days.scripture_text is
  'Screen 2 (Scripture): the focal verse text, shown in large typography.';
comment on column curriculum_days.scripture_audio_url is
  'Screen 2 (Scripture): optional URL for the immersive Lectio Divina / meditative audio.';
comment on column curriculum_days.exegesis_text is
  'Screen 3 (Exegesis): the Bios-vs-Zoe unpacking for the day. Distinct from fallback_text (which is the SMS-track teaching).';
comment on column curriculum_days.surrender_text is
  'Screen 5 (Surrender): the closing guided prayer / somatic release that sends them back into the world to live the challenge.';
