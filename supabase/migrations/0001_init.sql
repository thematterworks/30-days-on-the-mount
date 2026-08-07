-- 30 Days on the Mount — Core Schema
-- Applies to Supabase (PostgreSQL). Run via `supabase db push` or the SQL editor.
-- All application access goes through the service-role key from server-only code
-- (Vercel serverless functions). RLS is enabled with zero policies on every table,
-- so the `anon` / `authenticated` roles have no access; `service_role` bypasses RLS.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ============================================================================
-- Enums
-- ============================================================================
create type user_status as enum ('active', 'paused', 'completed', 'opted_out');
create type message_direction as enum ('inbound', 'outbound');
create type message_type as enum ('template', 'freeform', 'ai_generated');
create type message_status as enum ('sent', 'delivered', 'read', 'failed');
create type community_post_status as enum ('pending', 'approved', 'flagged', 'deleted');
create type blog_post_status as enum ('draft', 'published');

-- ============================================================================
-- users
-- ============================================================================
create table users (
  phone_number varchar(20) primary key,
  status user_status not null default 'active',
  current_day int not null default 0,
  start_date timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(), -- drives the Meta 24-hr free-form window
  ai_paused boolean not null default false, -- admin "Pause AI for this user" override
  notes text,
  created_at timestamptz not null default now()
);

create index users_status_idx on users (status);
create index users_current_day_idx on users (current_day);
create index users_last_interaction_at_idx on users (last_interaction_at desc);

comment on column users.last_interaction_at is
  'Updated on every inbound message. Meta''s free-form (non-template) reply window is 24h from this timestamp.';
comment on column users.ai_paused is
  'When true, the webhook handler logs inbound messages but skips AI auto-reply for this user, deferring to human intervention.';

-- ============================================================================
-- message_logs
-- ============================================================================
create table message_logs (
  id uuid primary key default gen_random_uuid(),
  phone_number varchar(20) not null references users (phone_number) on delete cascade,
  direction message_direction not null,
  message_type message_type not null,
  message_body text not null,
  whatsapp_message_id varchar(100),
  status message_status not null default 'sent',
  created_at timestamptz not null default now()
);

create index message_logs_phone_number_idx on message_logs (phone_number, created_at desc);
create index message_logs_created_at_idx on message_logs (created_at desc);
create index message_logs_status_idx on message_logs (status);

-- ============================================================================
-- curriculum_days
-- ============================================================================
create table curriculum_days (
  day_number int primary key check (day_number between 0 and 30),
  title varchar(255) not null,
  template_name varchar(100) not null,
  fallback_text text not null default '',
  ai_guidance_prompt text not null default ''
);

comment on column curriculum_days.template_name is 'Meta-approved WhatsApp template name used by the daily cron delivery engine.';
comment on column curriculum_days.fallback_text is 'Full rich-text prompt shown in the admin console and used if the template body needs a plain-text fallback.';
comment on column curriculum_days.ai_guidance_prompt is 'System instructions appended to the AI persona prompt when a user reflects on this specific day.';

-- ============================================================================
-- system_config
-- ============================================================================
create table system_config (
  key varchar(100) primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- community_posts (Module 2.5 — Community CMS moderation queue)
-- ============================================================================
create table community_posts (
  id uuid primary key default gen_random_uuid(),
  phone_number varchar(20) not null references users (phone_number) on delete cascade,
  day_number int,
  content text not null,
  status community_post_status not null default 'pending',
  moderated_at timestamptz,
  moderated_by varchar(100),
  created_at timestamptz not null default now()
);

create index community_posts_status_idx on community_posts (status, created_at desc);

-- ============================================================================
-- blog_posts (Module 2.5 — Blog publishing panel)
-- ============================================================================
create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug varchar(255) not null unique,
  title varchar(255) not null,
  content text not null,
  media_url text,
  status blog_post_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blog_posts_status_idx on blog_posts (status, published_at desc);

-- ============================================================================
-- updated_at maintenance
-- ============================================================================
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger blog_posts_set_updated_at
  before update on blog_posts
  for each row execute function set_updated_at();

create function set_system_config_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger system_config_set_updated_at
  before update on system_config
  for each row execute function set_system_config_updated_at();

-- ============================================================================
-- Row-Level Security — default deny for anon/authenticated, service_role bypasses RLS.
-- ============================================================================
alter table users enable row level security;
alter table message_logs enable row level security;
alter table curriculum_days enable row level security;
alter table system_config enable row level security;
alter table community_posts enable row level security;
alter table blog_posts enable row level security;

-- ============================================================================
-- Seed: system_config
-- ============================================================================
insert into system_config (key, value, description) values
  ('ai_auto_reply_enabled', 'true',
   'Global switch: when false, the webhook handler logs inbound reflections but never calls the AI engine or sends an automated reply.'),
  ('ai_persona_system_prompt',
   'You are a quiet companion accompanying someone through "30 Days on the Mount," a 30-day spiritual immersion practice. ' ||
   'Your responses ground the participant in active unlearning, stillness, Kenosis (self-emptying), the dropping of masks, ' ||
   'and Zoe (the deeper, uncreated life beneath performance and striving). ' ||
   'Never use gamified, challenge, streak, or performance-driven language ("day streak," "you''re crushing it," "keep up the momentum"). ' ||
   'Do not turn reflection into achievement. Respond briefly, warmly, and without therapeutic jargon or spiritual cliche. ' ||
   'Ask at most one gentle question. Never diagnose, never lecture. Meet the person exactly where their message leaves them.',
   'Global system prompt prepended to every AI-generated reflection reply. Edited from the Curriculum & AI Persona Tuner.'),
  ('whatsapp_graph_api_version', 'v19.0', 'Meta Graph API version used for all WhatsApp Cloud API calls.')
on conflict (key) do nothing;

-- ============================================================================
-- Seed: curriculum_days (structure for all 31 days; content authored via the admin CMS)
-- ============================================================================
insert into curriculum_days (day_number, title, template_name, fallback_text, ai_guidance_prompt) values
  (0, 'Welcome — Arriving at the Mount', 'day_00_welcome',
   'You''ve arrived. Over the next 30 days, nothing is being asked of you except to show up, exactly as you are. ' ||
   'There is no streak to keep, no performance to give. Each morning you''ll receive a short prompt — read it, sit with it, ' ||
   'and reply whenever something in you wants to speak. Today, simply notice: what would it feel like to stop performing, even for a moment?',
   'This is the participant''s first message. Welcome them without ceremony or hype. If they reply, receive whatever they bring — ' ||
   'resistance, skepticism, exhaustion, curiosity — without correcting or redirecting it. Do not explain the program further unless asked.')
on conflict (day_number) do nothing;

insert into curriculum_days (day_number, title, template_name, fallback_text, ai_guidance_prompt)
select d, 'Day ' || d || ' — Untitled', 'day_' || lpad(d::text, 2, '0') || '_prompt', '', ''
from generate_series(1, 30) as d
on conflict (day_number) do nothing;
