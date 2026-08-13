-- Dual-channel messaging (WhatsApp + Twilio SMS) and explicit evening
-- check-in tracking, replacing the old "infer from most recent outbound
-- template" heuristic in the webhook.

create type message_channel as enum ('whatsapp', 'sms');

-- ============================================================================
-- users: channel lock-in + evening check-in state
-- ============================================================================
alter table users
  add column if not exists channel message_channel not null default 'whatsapp',
  add column if not exists evening_sent_at timestamptz,
  add column if not exists evening_completed boolean not null default false;

comment on column users.channel is
  'Locked in the first time either webhook (WhatsApp or Twilio SMS) receives an inbound message from this phone number. Determines which provider (Meta Graph API or Twilio) all outbound sends use for this participant. Never changed after creation, even if the participant later messages via the other transport.';
comment on column users.evening_sent_at is
  'Timestamp of the most recently dispatched evening check-in. Set by the evening-checkin cron; used by the conversation engine to recognize a freeform reply as responding to tonight''s check-in.';
comment on column users.evening_completed is
  'True once the participant has replied at least once since evening_sent_at. Reset to false every time a fresh evening check-in is sent.';

-- ============================================================================
-- message_logs: generalize whatsapp_message_id -> provider_message_id (now
-- holds either a Meta wamid or a Twilio MessageSid) and record which
-- provider carried each message.
-- ============================================================================
alter table message_logs rename column whatsapp_message_id to provider_message_id;

alter table message_logs
  add column if not exists channel message_channel not null default 'whatsapp';

comment on column message_logs.provider_message_id is
  'Provider-native message id: a Meta wamid for whatsapp rows, a Twilio MessageSid for sms rows.';
comment on column message_logs.channel is 'Which provider carried this message.';

-- ============================================================================
-- curriculum_days: day-specific evening check-in content
-- ============================================================================
alter table curriculum_days
  add column if not exists evening_prompt_text text not null default '';

comment on column curriculum_days.evening_prompt_text is
  'Day-specific evening reflection prompt. Sent directly as the full SMS body for Twilio participants, since SMS has no pre-approval constraint. WhatsApp still sends the generic Meta-approved evening_checkin_template_name template from system_config, since a per-day template would require separate Meta approval for each day -- this column has no effect on the WhatsApp send. Empty string falls back to evening_checkin_fallback_text in system_config.';

-- ============================================================================
-- Seed: generic SMS evening fallback, used when a day's evening_prompt_text is empty.
-- ============================================================================
insert into system_config (key, value, description) values
  ('evening_checkin_fallback_text',
   'How did today''s practice sit with you? Reply and let me know what came up -- friction, resistance, or anything that landed. There''s no grade here, just grace.',
   'SMS evening check-in body sent when the active day''s curriculum_days.evening_prompt_text is empty. Not used for WhatsApp, which always sends the approved evening_checkin_template_name template instead.')
on conflict (key) do nothing;
