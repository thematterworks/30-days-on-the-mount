-- Adds a "waiting room" onboarding state ahead of the 30-day challenge.
-- New WhatsApp contacts are no longer auto-started on Day 0 — they land in
-- 'pending' until the switchboard (static ice-breakers or the Gatekeeper AI)
-- explicitly activates them. Application code (app/api/webhook/whatsapp)
-- always sets status/current_day explicitly on insert, so this migration
-- deliberately does NOT change the `status` column's default in the same
-- statement batch as adding the enum value — Postgres disallows using a
-- brand-new enum value in the same transaction that adds it, and Supabase's
-- SQL editor runs a pasted script as one batch. current_day's default has
-- nothing to do with the enum, so it's safe to change here.

alter type user_status add value if not exists 'pending';

-- current_day has no CHECK constraint on `users` (unlike curriculum_days,
-- which is keyed 0-30), so -1 is a safe "not started yet" sentinel — it
-- never collides with a real day number and is excluded from the daily
-- cron delivery for free, since that query only selects status = 'active'.
alter table users
  alter column current_day set default -1;

comment on column users.current_day is
  'Day 0-30 once active. -1 while status = ''pending'' (waiting room, not yet started).';
