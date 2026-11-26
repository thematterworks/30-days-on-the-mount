-- Blocking, and the Community Guidelines agreement (App Review 1.2: apps
-- with user-generated content must let people block abusive users and
-- agree to terms before posting).
--
-- A block hides each person's posts from the other, everywhere, and keeps
-- them out of the same matched group.

create table if not exists community_blocks (
  blocker varchar(20) not null references users (phone_number) on delete cascade,
  blocked varchar(20) not null references users (phone_number) on delete cascade,
  -- The name the blocker saw, for their list of blocked people.
  blocked_name text,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
create index if not exists community_blocks_blocked_idx on community_blocks (blocked);

-- When they agreed to the Community Guidelines, once, before first posting.
alter table users add column if not exists community_agreed_at timestamptz;
-- Agreeing to be matched included the guidelines.
update users set community_agreed_at = walking_terms_accepted_at
 where community_agreed_at is null and walking_terms_accepted_at is not null;

alter table community_blocks enable row level security;
