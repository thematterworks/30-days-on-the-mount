-- Premium access tier (free text-only vs. premium /journey PWA) and
-- one-time magic-link login tokens for the PWA. Sessions themselves are
-- stateless HMAC-signed cookies (see lib/participant-auth.ts), so there is
-- deliberately no sessions table here.

-- ============================================================================
-- users.access_tier
-- ============================================================================
create type access_tier as enum ('free', 'premium');

alter table users
  add column if not exists access_tier access_tier not null default 'free',
  add column if not exists premium_granted_at timestamptz;

create index if not exists users_access_tier_idx on users (access_tier);

comment on column users.access_tier is
  'free = text-only challenge (WhatsApp/SMS). premium = also has access to the /journey PWA. Gates both magic-link sending and the /journey session guard.';
comment on column users.premium_granted_at is
  'When this participant was upgraded to premium. Null for free users. Informational / analytics only.';

-- ============================================================================
-- magic_links — one-time, expiring, hashed PWA login tokens
-- ============================================================================
create table magic_links (
  id uuid primary key default gen_random_uuid(),
  phone_number varchar(20) not null references users (phone_number) on delete cascade,
  token_hash text not null unique,   -- sha256(raw token); the raw token is only ever in the delivered link
  expires_at timestamptz not null,
  consumed_at timestamptz,           -- null until first successful use; enforces single-use
  created_at timestamptz not null default now()
);

create index magic_links_phone_number_idx on magic_links (phone_number, created_at desc);
create index magic_links_expires_at_idx on magic_links (expires_at);

comment on table magic_links is
  'One-time login tokens delivered via the daily premium text (Twilio/WhatsApp). Exchanged at /journey/enter for a signed session cookie. Only the sha256 hash is stored.';

-- RLS: service-role-only, matching every other table in this schema.
alter table magic_links enable row level security;
