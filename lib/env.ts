import "server-only";

type RequiredEnvVar =
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "WHATSAPP_TOKEN"
  | "WHATSAPP_PHONE_NUMBER_ID"
  | "WHATSAPP_VERIFY_TOKEN"
  | "CRON_SECRET"
  | "ADMIN_EMAIL"
  | "ADMIN_PASSWORD_HASH"
  | "ADMIN_SESSION_SECRET";

function readEnv(name: RequiredEnvVar): string {
  // .trim() guards against the common copy/paste gotcha of a trailing
  // newline or space sneaking into a Vercel env var value, which otherwise
  // surfaces as a confusing "invalid API key" / auth failure downstream.
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * The AI engine key is accepted under either name: `AI_API_KEY` (this
 * project's documented name, per .env.example) or `ANTHROPIC_API_KEY` (the
 * name Anthropic's own docs and SDKs default to). Whichever is set wins;
 * `AI_API_KEY` takes precedence if both are present.
 */
function readAiApiKey(): string {
  const value = process.env.AI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (!value) {
    throw new Error("Missing required environment variable: AI_API_KEY (or ANTHROPIC_API_KEY)");
  }
  return value;
}

export const env = {
  get SUPABASE_URL() {
    return readEnv("SUPABASE_URL");
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return readEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  get WHATSAPP_TOKEN() {
    return readEnv("WHATSAPP_TOKEN");
  },
  get WHATSAPP_PHONE_NUMBER_ID() {
    return readEnv("WHATSAPP_PHONE_NUMBER_ID");
  },
  get WHATSAPP_VERIFY_TOKEN() {
    return readEnv("WHATSAPP_VERIFY_TOKEN");
  },
  get AI_API_KEY() {
    return readAiApiKey();
  },
  get CRON_SECRET() {
    return readEnv("CRON_SECRET");
  },
  get ADMIN_EMAIL() {
    return readEnv("ADMIN_EMAIL");
  },
  get ADMIN_PASSWORD_HASH() {
    return readEnv("ADMIN_PASSWORD_HASH");
  },
  get ADMIN_SESSION_SECRET() {
    return readEnv("ADMIN_SESSION_SECRET");
  },
};
