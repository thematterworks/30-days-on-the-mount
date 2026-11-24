-- The native app's voice and sound (app/api/mobile/speech, /ambient).

-- Synthesized narration, cached so each passage is paid for once. Private:
-- companion replies are personal, so files are served by short-lived signed
-- URLs, never publicly.
insert into storage.buckets (id, name, public)
values ('speech', 'speech', false)
on conflict (id) do nothing;

-- The ambient music the app rotates through. A JSON array of
-- { "title", "artist", "url", "credit" } — edit it here to add or retire a
-- track without an app release. "credit" is the attribution line a
-- Creative Commons licence requires, shown in Profile → About → Music.
insert into system_config (key, value, description)
values (
  'ambient_tracks',
  '[{"title":"Weightless Stillness","artist":"30 Days on the Mount","url":"https://abhbwguyrpjgqbyhomll.supabase.co/storage/v1/object/public/audio/Weightless_Stillness_2026-06-01T180237.mp3","credit":null}]',
  'Ambient music the iOS app rotates through: JSON array of {title, artist, url, credit}.'
)
on conflict (key) do nothing;
