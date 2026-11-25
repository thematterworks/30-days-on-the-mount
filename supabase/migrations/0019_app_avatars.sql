-- The app's profile icons (app/api/mobile/avatar), kept with the account so
-- they survive signing out. Private: photos are served by signed URLs.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;
