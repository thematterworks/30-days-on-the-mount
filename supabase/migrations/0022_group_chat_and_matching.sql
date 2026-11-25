-- Walking groups become conversations, and strangers can be matched into them.
--
-- Chat: a group's posts are one continuous thread across the days (each
-- message still carries the day it was written on). last_read_at drives the
-- unread dot; last_notified_at spaces out "new in your group" notifications.
--
-- Matching (lib/matching.ts): someone opts in from Profile → Together after
-- confirming they're 18+ and agreeing to the guidelines. They wait in
-- walking_match_requests until there are enough people on nearby days, then
-- a 'matched' group is formed. Matched groups have no invitations and no
-- private messages; contact details are kept out by the screen.

alter table walking_groups
  add column if not exists kind text not null default 'friends' check (kind in ('friends', 'matched')),
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists last_nudged_at timestamptz;

alter table walking_group_members
  add column if not exists last_read_at timestamptz not null default now(),
  add column if not exists last_notified_at timestamptz;

-- Agreed once, before the first match.
alter table users
  add column if not exists walking_terms_accepted_at timestamptz,
  -- Set when someone's posts in matched groups are repeatedly held as
  -- harmful: they're removed from matched groups and can't rejoin matching.
  add column if not exists matching_blocked_at timestamptz;

create table if not exists walking_match_requests (
  phone_number varchar(20) primary key references users (phone_number) on delete cascade,
  display_name text,
  requested_at timestamptz not null default now()
);

-- Posts by the companion itself (a quiet group's nudge) have no author.
alter table community_posts alter column phone_number drop not null;

create index if not exists walking_groups_kind_idx on walking_groups (kind, created_at);

alter table walking_match_requests enable row level security;
