import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

let client: SupabaseClient<Database> | null = null;

/**
 * Service-role Supabase client. Bypasses RLS — server-only, never import
 * this from a Client Component or expose the key to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
