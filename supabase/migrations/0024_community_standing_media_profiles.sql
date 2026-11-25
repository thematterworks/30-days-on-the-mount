-- Community standing, media in group conversations, and soft member profiles.
--
-- Standing (lib/standing.ts, written out in /community-guidelines):
--   1st strike in 90 days  → a private warning
--   2nd strike in 90 days  → 7 days without posting
--   3rd strike in 90 days  → removed from Community
--   Severe violations skip straight to removal from Community, or the
--   account is suspended outright.
-- Distress is never a strike.

alter table users
  add column if not exists community_status text not null default 'active'
    check (community_status in ('active', 'paused', 'removed', 'suspended')),
  add column if not exists community_paused_until timestamptz,
  -- Shown to the participant once, in Community, then cleared.
  add column if not exists community_notice text,
  -- "A word about me": one screened line on their member card.
  add column if not exists about text;

create table if not exists community_strikes (
  id uuid primary key default gen_random_uuid(),
  phone_number varchar(20) not null references users (phone_number) on delete cascade,
  post_id uuid references community_posts (id) on delete set null,
  guideline text not null,
  note text,
  -- 'screen' (automatic) or 'admin'.
  source text not null default 'screen',
  severity text not null default 'standard' check (severity in ('standard', 'severe')),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists community_strikes_phone_idx on community_strikes (phone_number, created_at desc);

-- A photo, video or voice message with a group post:
-- {kind, path, thumbPath?, duration?, width?, height?, transcript?}
alter table community_posts add column if not exists media jsonb;

-- What the admin did, and to whom: the record behind every action.
create table if not exists moderation_actions (
  id uuid primary key default gen_random_uuid(),
  phone_number varchar(20) references users (phone_number) on delete set null,
  post_id uuid references community_posts (id) on delete set null,
  action text not null,
  note text,
  actor text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table community_strikes enable row level security;
alter table moderation_actions enable row level security;
