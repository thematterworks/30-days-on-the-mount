-- Aligns existing participants with the new 08:00 default delivery hour.
--
-- Migration 0005 backfilled every pre-existing non-pending participant to
-- preferred_delivery_hour = 7, which was correct at the time: it preserved
-- what the old fixed 14:00 UTC cron produced during PDT. The default has now
-- moved to 8 (lib/timezone.ts DEFAULT_PREFERRED_HOUR), so without this
-- backfill the system would split in two — everyone who existed before today
-- stays on 07:00 while every new participant lands on 08:00.
--
-- Scoped deliberately to rows still sitting on exactly 7. Anyone who picked
-- their own hour through the old conversational onboarding is left untouched,
-- and 7 is indistinguishable from a deliberate choice of 7 only for the small
-- set of users who explicitly chose it — an acceptable trade for putting
-- everyone else on one schedule.
--
-- The evening check-in needs no equivalent backfill: it derives its target
-- hour from preferred_delivery_hour + EVENING_OFFSET_HOURS at send time, so
-- updating the morning hour moves the evening touchpoint with it.

update users
set preferred_delivery_hour = 8
where preferred_delivery_hour = 7
  and status <> 'pending';
