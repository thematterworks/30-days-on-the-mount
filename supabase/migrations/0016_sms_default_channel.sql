-- Retires 'whatsapp' as the default outbound channel.
--
-- Migration 0008 introduced users.channel with `default 'whatsapp'`, which was
-- right at the time: WhatsApp was the live transport and SMS was being added
-- alongside it. That is now inverted — WhatsApp is retired and SMS is the only
-- transport — but the default was never changed, so every row created before
-- the SMS channel existed still says 'whatsapp'.
--
-- Replies are dispatched on users.channel, so those rows sent every outbound
-- message to the Meta Graph API instead of Twilio. The failure was invisible
-- from the participant's side: the inbound webhook returned 200 and stored the
-- message, the Graph call failed, and nothing ever arrived on their phone.
--
-- The conversation engine now reconciles users.channel with the transport each
-- inbound message actually arrives on, which repairs a row the moment that
-- participant texts in. This migration covers the rest: the column default for
-- new rows, and existing rows belonging to participants who have not texted in
-- since the fix — including ones only ever reached by the daily-push cron,
-- which has no inbound message to trigger reconciliation.

alter table users
  alter column channel set default 'sms';

alter table message_logs
  alter column channel set default 'sms';

comment on column users.channel is
  'Transport used for outbound messages to this participant. Reconciled to the channel of their most recent inbound message by lib/conversation-engine.ts. WhatsApp is retired; new rows default to sms.';

-- Backfill every legacy row. Safe because WhatsApp is retired: there is no
-- participant for whom 'whatsapp' is still a working outbound transport, so a
-- row left on it can only fail.
update users
set channel = 'sms'
where channel = 'whatsapp';
