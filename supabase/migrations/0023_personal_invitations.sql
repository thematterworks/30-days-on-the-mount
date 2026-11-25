-- Share the journey: every participant gets their own invitation link
-- (/i/CODE), which opens a welcome-style page carrying their first name.
alter table users
  add column if not exists invite_code text unique,
  add column if not exists invite_opens int not null default 0;
