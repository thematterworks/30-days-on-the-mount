-- Gifts that keep the journey free (lib/giving.ts), recorded from Stripe
-- webhooks (app/api/stripe/webhook): one row per payment, one-time or a
-- monthly renewal, and one row per monthly giver.

create table if not exists gifts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('once', 'monthly')),
  amount_cents int not null,
  currency text not null default 'usd',
  email text,
  source text,
  status text not null default 'paid' check (status in ('pending', 'paid', 'failed', 'refunded', 'disputed')),
  stripe_customer text,
  stripe_checkout_session text unique,
  stripe_invoice text unique,
  stripe_subscription text,
  stripe_payment_intent text,
  created_at timestamptz not null default now()
);
create index if not exists gifts_payment_intent_idx on gifts (stripe_payment_intent);

create table if not exists monthly_givers (
  stripe_subscription text primary key,
  stripe_customer text,
  email text,
  amount_cents int,
  status text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table gifts enable row level security;
alter table monthly_givers enable row level security;
