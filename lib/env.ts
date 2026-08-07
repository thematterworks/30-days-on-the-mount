import "server-only";

type RequiredEnvVar =
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "WHATSAPP_TOKEN"
  | "WHATSAPP_PHONE_NUMBER_ID"
  | "WHATSAPP_VERIFY_TOKEN"
  | "AI_API_KEY"
  | "CRON_SECRET"
  | "ADMIN_EMAIL"
  | "ADMIN_PASSWORD_HASH"
  | "ADMIN_SESSION_SECRET";

function readEnv(name: RequiredEnvVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
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
    return readEnv("AI_API_KEY");
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
