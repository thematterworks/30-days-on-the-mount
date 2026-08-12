-- Upgrades onboarding from a single-message activation to a conversational,
-- stateful flow that collects a name, a preferred delivery hour, and an
-- optional email address before a participant goes active.

alter table users
  add column if not exists first_name text,
  add column if not exists preferred_delivery_hour int,
  add column if not exists timezone text not null default 'America/Los_Angeles',
  add column if not exists wants_email boolean not null default false,
  add column if not exists email_address text,
  add column if not exists onboarding_step text not null default 'not_started';

alter table users
  add constraint users_preferred_delivery_hour_check
  check (preferred_delivery_hour is null or preferred_delivery_hour between 0 and 23);

alter table users
  add constraint users_onboarding_step_check
  check (onboarding_step in ('not_started', 'awaiting_name', 'awaiting_time', 'awaiting_email_pref', 'awaiting_email_address', 'completed'));

create index if not exists users_preferred_delivery_hour_idx on users (preferred_delivery_hour);

comment on column users.preferred_delivery_hour is
  'Local hour (0-23) the participant wants their daily push, interpreted against `timezone`. Null while still onboarding.';
comment on column users.onboarding_step is
  'Conversational onboarding state for a pending participant. Irrelevant once status is no longer ''pending''.';

-- Backfill: anyone not currently in the waiting room has already finished
-- onboarding by definition — the column default of 'not_started' would
-- otherwise misdescribe every existing active/paused/completed/opted_out row.
update users set onboarding_step = 'completed' where status <> 'pending';

-- Backfill: existing active (and paused/completed/opted_out) participants
-- went through the old flow and never chose a delivery hour, so they'd have
-- preferred_delivery_hour = null. The new hourly cron only sends on an exact
-- hour match, so leaving this null would silently stop their daily push
-- forever. Hour 7 in the new default timezone (America/Los_Angeles) is what
-- the old fixed 14:00 UTC cron currently converts to during PDT, so this
-- preserves today's delivery time for everyone already in the system.
update users set preferred_delivery_hour = 7 where status <> 'pending' and preferred_delivery_hour is null;
