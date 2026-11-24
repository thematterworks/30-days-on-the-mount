-- The native iOS app as a first-class channel.
--
-- 'app' joins the message channel enum: companion conversations held in the
-- app are logged alongside SMS in message_logs, so a participant has one
-- continuous history whichever way they reach us.
--
-- sign_in_codes holds the one-time codes the app texts for phone-number
-- sign-in. Only a hash is stored, codes expire, failed attempts are counted,
-- and sends are counted per hour so the endpoint can't be used to flood a
-- number. Keyed by phone rather than referencing users, because the person
-- signing in may not have a row yet.
--
-- devices holds each installed app's APNs token (and Live Activity push token)
-- so the server can reach a participant by push. It cascades with the
-- participant, like every other participant table, so deleting an account
-- deletes its devices.

alter type message_channel add value if not exists 'app';

create table if not exists sign_in_codes (
  phone_number text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sends_in_window integer not null default 1,
  window_started_at timestamptz not null default now()
);
alter table sign_in_codes enable row level security;

create table if not exists devices (
  apns_token text primary key,
  phone_number text not null references users (phone_number) on delete cascade,
  live_activity_token text,
  environment text not null check (environment in ('development', 'production')),
  updated_at timestamptz not null default now()
);
create index if not exists devices_phone_number_idx on devices (phone_number);
alter table devices enable row level security;
