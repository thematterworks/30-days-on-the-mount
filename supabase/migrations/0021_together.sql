-- Together (Profile → Together): reflections shared with others walking the
-- same day, and walking-companion groups of friends.
--
-- Everything shared is screened by Claude first (lib/moderation.ts): clearly
-- safe posts are approved; uncertain ones wait as 'pending' in the admin
-- queue; anything showing distress is held as 'flagged' and its author is
-- offered support privately.

-- A post's name as shown: a first name, or null for "Someone on the journey".
alter table community_posts
  add column if not exists display_name text,
  add column if not exists group_id uuid,
  add column if not exists moderation_note text,
  add column if not exists report_count int not null default 0;

create table if not exists walking_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by varchar(20) references users (phone_number) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists walking_group_members (
  group_id uuid not null references walking_groups (id) on delete cascade,
  phone_number varchar(20) not null references users (phone_number) on delete cascade,
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (group_id, phone_number)
);

do $$ begin
  alter table community_posts
    add constraint community_posts_group_fk foreign key (group_id) references walking_groups (id) on delete cascade;
exception when duplicate_object then null; end $$;

create table if not exists community_reports (
  post_id uuid not null references community_posts (id) on delete cascade,
  phone_number varchar(20) not null references users (phone_number) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, phone_number)
);

create index if not exists community_posts_day_idx on community_posts (day_number, status, created_at desc) where group_id is null;
create index if not exists community_posts_group_idx on community_posts (group_id, day_number, created_at);
create index if not exists walking_group_members_phone_idx on walking_group_members (phone_number);

-- Server-only, like every other participant table.
alter table walking_groups enable row level security;
alter table walking_group_members enable row level security;
alter table community_reports enable row level security;
