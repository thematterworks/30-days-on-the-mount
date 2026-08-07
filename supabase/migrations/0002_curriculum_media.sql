-- Adds media (photo/video) support to the curriculum day editor.

alter table curriculum_days
  add column if not exists media_url text;

comment on column curriculum_days.media_url is
  'Public URL of an optional photo/video asset associated with this day, stored in the curriculum-media Storage bucket.';

-- Public bucket: service_role (server-only) does all writes and bypasses storage
-- RLS the same way it does for every other table; `public = true` lets the
-- bucket serve objects over their public URL for read-only display without
-- needing separate storage.objects policies.
insert into storage.buckets (id, name, public)
values ('curriculum-media', 'curriculum-media', true)
on conflict (id) do nothing;
