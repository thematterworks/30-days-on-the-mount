-- Widens curriculum_days from 31 slots (day_number 0-30) to 32 (0-31).
-- The 30-day curriculum's source content is numbered Day 1 through Day 31
-- (31 days of teaching), kept separate from the existing Day 0 welcome/
-- onboarding message rather than replacing it — so the table needs one
-- more slot than its original 0-30 range.
--
-- Postgres has no "alter check constraint" — drop and re-add. The name
-- below is Postgres's default auto-generated name for an inline CHECK on
-- `day_number` declared in CREATE TABLE (0001_init.sql); `if exists` makes
-- this safe to run even if it was ever renamed.

alter table curriculum_days drop constraint if exists curriculum_days_day_number_check;
alter table curriculum_days add constraint curriculum_days_day_number_check check (day_number between 0 and 31);

comment on column curriculum_days.day_number is 'Day 0 (welcome) through Day 31 (final day of the 31-day teaching arc).';
