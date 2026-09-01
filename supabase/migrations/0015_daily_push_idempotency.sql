-- Makes the daily curriculum push idempotent per participant per local day.
--
-- daily-push advances users.current_day on every successful send and had no
-- record of whether it had already run for that participant today. Two
-- invocations inside the same local hour therefore delivered two consecutive
-- days of curriculum, permanently skipping a day of that participant's
-- content. Selecting on an exact local-hour match was the only thing keeping
-- that from happening, which made correctness a property of the scheduler's
-- punctuality rather than of the data.
--
-- last_push_on stores the participant's own local calendar date (their
-- timezone, not UTC), so "one push per day" means one per *their* day.

alter table users
  add column if not exists last_push_on date;

comment on column users.last_push_on is
  'Local calendar date (in `timezone`) of the participant''s most recent daily curriculum push. Null means never pushed. Read by the daily-push cron as a one-per-local-day idempotency guard.';

create index if not exists users_last_push_on_idx on users (last_push_on);

-- Backfill: existing active participants have already received content today
-- or earlier, but with a null last_push_on the new at-or-after-the-hour
-- selection would treat them as never pushed and send immediately on the next
-- run, regardless of the hour. Seeding yesterday's date makes them eligible
-- again at their normal hour tomorrow without an out-of-schedule send today.
update users
set last_push_on = (now() at time zone coalesce(timezone, 'America/Los_Angeles'))::date - 1
where status = 'active'
  and last_push_on is null;
