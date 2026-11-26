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
/** "app" is the native iOS app (migration 0017): companion messages held in-app. */
export type MessageChannel = "whatsapp" | "sms" | "app";
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
  /** Local calendar date (YYYY-MM-DD, in the participant's timezone) of their most recent daily curriculum push. */
  last_push_on: string | null;
  /** Local date of the last midday notification. */
  midday_sent_on: string | null;
  /** Whether they want the midday notification (Profile → Notifications). */
  midday_invitations: boolean;
  /** When they confirmed they're 18+ and agreed to the walking-group guidelines. */
  walking_terms_accepted_at: string | null;
  /** Set when repeated harmful posts ended their place in matched groups. */
  matching_blocked_at: string | null;
  /** Their personal Share-the-journey link: /i/CODE. */
  invite_code: string | null;
  invite_opens: number;
  /** Community standing (lib/standing.ts). */
  community_status: "active" | "paused" | "removed" | "suspended";
  community_paused_until: string | null;
  community_notice: string | null;
  /** "A word about me", on their member card. */
  about: string | null;
  /** When they agreed to the Community Guidelines, before first posting. */
  community_agreed_at: string | null;
};

export type CommunityBlockRow = {
  blocker: string;
  blocked: string;
  blocked_name: string | null;
  created_at: string;
};

export type GiftRow = {
  id: string;
  kind: "once" | "monthly";
  amount_cents: number;
  currency: string;
  email: string | null;
  source: string | null;
  status: "pending" | "paid" | "failed" | "refunded" | "disputed";
  stripe_customer: string | null;
  stripe_checkout_session: string | null;
  stripe_invoice: string | null;
  stripe_subscription: string | null;
  stripe_payment_intent: string | null;
  created_at: string;
};

export type MonthlyGiverRow = {
  stripe_subscription: string;
  stripe_customer: string | null;
  email: string | null;
  amount_cents: number | null;
  status: string;
  started_at: string;
  ended_at: string | null;
};

export type CommunityStrikeRow = {
  id: string;
  phone_number: string;
  post_id: string | null;
  guideline: string;
  note: string | null;
  source: string;
  severity: "standard" | "severe";
  revoked_at: string | null;
  created_at: string;
};

export type ModerationActionRow = {
  id: string;
  phone_number: string | null;
  post_id: string | null;
  action: string;
  note: string | null;
  actor: string;
  created_at: string;
};

/** A photo, video or voice message with a group post. */
export type PostMedia = {
  kind: "image" | "video" | "audio";
  path: string;
  thumbPath?: string;
  /** A video's frames, laid out in one image, for the screen. */
  framesPath?: string;
  duration?: number;
  width?: number;
  height?: number;
  transcript?: string;
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
  morning_push_text: string;
  midday_push_text: string;
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
  /** Null for the companion's own messages in a group. */
  phone_number: string | null;
  day_number: number | null;
  content: string;
  status: CommunityPostStatus;
  moderated_at: string | null;
  moderated_by: string | null;
  created_at: string;
  display_name: string | null;
  group_id: string | null;
  moderation_note: string | null;
  report_count: number;
  media: PostMedia | null;
};

export type WalkingGroupRow = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  kind: "friends" | "matched";
  last_activity_at: string;
  last_nudged_at: string | null;
};

export type WalkingMatchRequestRow = {
  phone_number: string;
  display_name: string | null;
  requested_at: string;
};

export type WalkingGroupMemberRow = {
  group_id: string;
  phone_number: string;
  display_name: string | null;
  joined_at: string;
  last_read_at: string;
  last_notified_at: string | null;
};

export type CommunityReportRow = {
  post_id: string;
  phone_number: string;
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

export type SignInCodeRow = {
  phone_number: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  sends_in_window: number;
  window_started_at: string;
};

export type DeviceRow = {
  apns_token: string;
  phone_number: string;
  live_activity_token: string | null;
  environment: "development" | "production";
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
      sign_in_codes: {
        Row: SignInCodeRow;
        Insert: Partial<SignInCodeRow> & { phone_number: string; code_hash: string; expires_at: string };
        Update: Partial<SignInCodeRow>;
        Relationships: [];
      };
      devices: {
        Row: DeviceRow;
        Insert: Partial<DeviceRow> & { apns_token: string; phone_number: string; environment: DeviceRow["environment"] };
        Update: Partial<DeviceRow>;
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
        Insert: Partial<CommunityPostRow> & { phone_number: string | null; content: string };
        Update: Partial<CommunityPostRow>;
        Relationships: [];
      };
      walking_groups: {
        Row: WalkingGroupRow;
        Insert: Partial<WalkingGroupRow> & { name: string; invite_code: string };
        Update: Partial<WalkingGroupRow>;
        Relationships: [];
      };
      walking_group_members: {
        Row: WalkingGroupMemberRow;
        Insert: Partial<WalkingGroupMemberRow> & { group_id: string; phone_number: string };
        Update: Partial<WalkingGroupMemberRow>;
        Relationships: [];
      };
      walking_match_requests: {
        Row: WalkingMatchRequestRow;
        Insert: Partial<WalkingMatchRequestRow> & { phone_number: string };
        Update: Partial<WalkingMatchRequestRow>;
        Relationships: [];
      };
      gifts: {
        Row: GiftRow;
        Insert: Partial<GiftRow> & { kind: GiftRow["kind"]; amount_cents: number };
        Update: Partial<GiftRow>;
        Relationships: [];
      };
      monthly_givers: {
        Row: MonthlyGiverRow;
        Insert: Partial<MonthlyGiverRow> & { stripe_subscription: string; status: string };
        Update: Partial<MonthlyGiverRow>;
        Relationships: [];
      };
      community_blocks: {
        Row: CommunityBlockRow;
        Insert: Partial<CommunityBlockRow> & { blocker: string; blocked: string };
        Update: Partial<CommunityBlockRow>;
        Relationships: [];
      };
      community_strikes: {
        Row: CommunityStrikeRow;
        Insert: Partial<CommunityStrikeRow> & { phone_number: string; guideline: string };
        Update: Partial<CommunityStrikeRow>;
        Relationships: [];
      };
      moderation_actions: {
        Row: ModerationActionRow;
        Insert: Partial<ModerationActionRow> & { action: string };
        Update: Partial<ModerationActionRow>;
        Relationships: [];
      };
      community_reports: {
        Row: CommunityReportRow;
        Insert: Partial<CommunityReportRow> & { post_id: string; phone_number: string };
        Update: Partial<CommunityReportRow>;
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
