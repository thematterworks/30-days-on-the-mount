-- Email Styling Engine: lets non-developers tune the daily curriculum
-- email's visual identity (colors, fonts, header image) from the admin
-- dashboard without a code deploy.
--
-- system_config already exists (migration 0001) with `value text`, not
-- jsonb — every existing config value (ai_persona_system_prompt,
-- evening_checkin_template_name, ai_auto_reply_enabled, ...) is read as a
-- plain string by lib/system-config.ts and the admin Persona Tuner UI.
-- Changing the column to jsonb would change the runtime shape of every one
-- of those existing values and their TypeScript types for no functional
-- gain. Instead, the theme object is JSON-stringified into the existing
-- text column — same practical outcome (a structured, retrievable object),
-- zero blast radius on what's already shipped. lib/system-config.ts's
-- getEmailTheme()/updateEmailTheme() handle the JSON.parse/stringify.
--
-- The `create table if not exists` below is a no-op safety net matching
-- 0001's exact shape, in case this migration is ever run against a fresh
-- database out of order.

create table if not exists system_config (
  key varchar(100) primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into system_config (key, value, description) values
  ('email_theme_v1',
   '{"background_gradient":"linear-gradient(135deg, #4A4E7E 0%, #313554 100%)","primary_accent_color":"#D2B48C","secondary_accent_color":"#FFFFFF","main_font_family":"Georgia, ''Times New Roman'', serif","alt_font_family":"Helvetica, Arial, sans-serif","body_text_color":"#FFFFFF","header_mountain_image_url":"","title_font_size":"32px","subtext_font_size":"14px","body_font_size":"16px","line_height":"1.6"}',
   'JSON-encoded visual theme (colors, fonts, header image) for the daily curriculum email, consumed by lib/email.ts. Edit via the admin Email Design panel (/admin/email-settings), not directly — the app always merges partial updates over the current value so unset fields are never lost.')
on conflict (key) do nothing;
