// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Keep in sync manually, or regenerate with `supabase gen types typescript`.
//
// NOTE: these are `type` aliases, not `interface`s. Interfaces don't satisfy
// the implicit-index-signature check supabase-js's generics rely on to infer
// row types from the Database generic, which silently collapses every query
// result to `never`. See supabase/supabase-js#soon-to-be-known-gotcha.

export type UserStatus = "pending" | "active" | "paused" | "completed" | "opted_out";
export type OnboardingStep =
  | "not_started"
  | "awaiting_name"
  | "awaiting_time"
  | "awaiting_email_pref"
  | "awaiting_email_address"
  | "completed";
export type MessageDirection = "inbound" | "outbound";
export type MessageType = "template" | "freeform" | "ai_generated";
export type MessageStatus = "sent" | "delivered" | "read" | "failed";
export type MessageChannel = "whatsapp" | "sms";
export type AccessTier = "free" | "premium";
export type CommunityPostStatus = "pending" | "approved" | "flagged" | "deleted";
export type BlogPostStatus = "draft" | "published";

export type UserRow = {
  phone_number: string;
  status: UserStatus;
  current_day: number;
  start_date: string;
  last_interaction_at: string;
  ai_paused: boolean;
  notes: string | null;
  created_at: string;
  first_name: string | null;
  preferred_delivery_hour: number | null;
  timezone: string;
  wants_email: boolean;
  email_address: string | null;
  onboarding_step: OnboardingStep;
  channel: MessageChannel;
  evening_sent_at: string | null;
  evening_completed: boolean;
  access_tier: AccessTier;
  premium_granted_at: string | null;
};

export type MagicLinkRow = {
  id: string;
  phone_number: string;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type MessageLogRow = {
  id: string;
  phone_number: string;
  direction: MessageDirection;
  message_type: MessageType;
  message_body: string;
  provider_message_id: string | null;
  status: MessageStatus;
  created_at: string;
  channel: MessageChannel;
};

export type CurriculumDayRow = {
  day_number: number;
  title: string;
  template_name: string;
  fallback_text: string;
  ai_guidance_prompt: string;
  media_url: string | null;
  evening_prompt_text: string;
  hook_text: string;
  scripture_reference: string;
  scripture_text: string;
  scripture_audio_url: string;
  teaching_video_url: string;
  exegesis_text: string;
  surrender_text: string;
};

export type SystemConfigRow = {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
};

export type CommunityPostRow = {
  id: string;
  phone_number: string;
  day_number: number | null;
  content: string;
  status: CommunityPostStatus;
  moderated_at: string | null;
  moderated_by: string | null;
  created_at: string;
};

export type CommunityReflectionRow = {
  id: string;
  day_number: number;
  phone_number: string;
  display_name: string;
  reflection_text: string;
  is_approved: boolean;
  created_at: string;
};

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  media_url: string | null;
  status: BlogPostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Partial<UserRow> & { phone_number: string };
        Update: Partial<UserRow>;
        Relationships: [];
      };
      message_logs: {
        Row: MessageLogRow;
        Insert: Partial<MessageLogRow> & {
          phone_number: string;
          direction: MessageDirection;
          message_type: MessageType;
          message_body: string;
        };
        Update: Partial<MessageLogRow>;
        Relationships: [];
      };
      magic_links: {
        Row: MagicLinkRow;
        Insert: Partial<MagicLinkRow> & { phone_number: string; token_hash: string; expires_at: string };
        Update: Partial<MagicLinkRow>;
        Relationships: [];
      };
      curriculum_days: {
        Row: CurriculumDayRow;
        Insert: Partial<CurriculumDayRow> & { day_number: number; title: string; template_name: string };
        Update: Partial<CurriculumDayRow>;
        Relationships: [];
      };
      system_config: {
        Row: SystemConfigRow;
        Insert: Partial<SystemConfigRow> & { key: string; value: string };
        Update: Partial<SystemConfigRow>;
        Relationships: [];
      };
      community_posts: {
        Row: CommunityPostRow;
        Insert: Partial<CommunityPostRow> & { phone_number: string; content: string };
        Update: Partial<CommunityPostRow>;
        Relationships: [];
      };
      community_reflections: {
        Row: CommunityReflectionRow;
        Insert: Partial<CommunityReflectionRow> & {
          day_number: number;
          phone_number: string;
          reflection_text: string;
        };
        Update: Partial<CommunityReflectionRow>;
        Relationships: [];
      };
      blog_posts: {
        Row: BlogPostRow;
        Insert: Partial<BlogPostRow> & { slug: string; title: string; content: string };
        Update: Partial<BlogPostRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
