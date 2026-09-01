-- The Daily Community Reflection Wall: a quiet, per-day communal space in
-- the /journey PWA where participants see they aren't climbing alone.
--
-- Distinct from the existing community_posts table (the admin-CMS moderation
-- queue from 0001): this one is purpose-built for the PWA wall, keyed by
-- day_number, with author attribution and a lightweight approve flag.

create table community_reflections (
  id uuid primary key default gen_random_uuid(),
  day_number int not null references curriculum_days (day_number),
  phone_number varchar(20) not null references users (phone_number) on delete cascade,
  display_name text not null default 'Anonymous',
  reflection_text text not null,
  is_approved boolean not null default true, -- visible by default; admin can flag/hide
  created_at timestamptz not null default now()
);

-- The hot path: fetch approved reflections for one day, newest first.
create index community_reflections_day_idx on community_reflections (day_number, is_approved, created_at desc);
create index community_reflections_phone_idx on community_reflections (phone_number, created_at desc);

comment on column community_reflections.display_name is
  'Server-derived attribution shown on the wall: the participant''s first name, or "Anonymous". Never the phone number.';
comment on column community_reflections.is_approved is
  'True by default (post-moderation model). An admin can set false to hide a flagged entry from the wall.';

-- RLS: service-role-only, matching every other table. All access goes through
-- the participant-gated API routes using the service-role client.
alter table community_reflections enable row level security;
