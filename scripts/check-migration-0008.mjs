// Read-only: confirms migration 0008 (dual-channel + evening check-in) is
// actually applied to the live database before we deploy code that depends
// on it. Probes for the renamed/new columns via PostgREST, which returns a
// clear error if a selected column doesn't exist.
//
// Credentials read from .env.local (gitignored), same pattern as the other
// scripts/ files. Prints only pass/fail per column — never secrets.
//
// Usage: node scripts/check-migration-0008.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function readEnvLocal(key) {
  const lines = readFileSync(join(rootDir, ".env.local"), "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match || match[1] !== key) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value.trim();
  }
  return undefined;
}

const rawUrl = readEnvLocal("SUPABASE_URL");
const serviceKey = readEnvLocal("SUPABASE_SERVICE_ROLE_KEY");

if (!rawUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Normalize to bare origin — the stored value has historically carried a
// trailing /rest/v1/ path that PostgREST requests must not double up on.
const origin = new URL(rawUrl).origin;

/** Probe a single column with limit=0: 200 => exists, 400 (42703) => missing. */
async function columnExists(table, column) {
  const url = `${origin}/rest/v1/${table}?select=${column}&limit=0`;
  const response = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (response.ok) return { ok: true };
  const payload = await response.json().catch(() => null);
  return { ok: false, error: payload?.message ?? `HTTP ${response.status}` };
}

const checks = [
  ["users", "channel"],
  ["users", "evening_sent_at"],
  ["users", "evening_completed"],
  ["message_logs", "provider_message_id"],
  ["message_logs", "channel"],
  ["curriculum_days", "evening_prompt_text"],
];

console.log(`Checking migration 0008 against ${origin} ...\n`);

let allPresent = true;
for (const [table, column] of checks) {
  const result = await columnExists(table, column);
  if (result.ok) {
    console.log(`  ✓ ${table}.${column}`);
  } else {
    allPresent = false;
    console.log(`  ✗ ${table}.${column} — ${result.error}`);
  }
}

// The old column must be GONE (renamed), not just the new one present.
const oldColumn = await columnExists("message_logs", "whatsapp_message_id");
console.log(
  oldColumn.ok
    ? `  ! message_logs.whatsapp_message_id STILL EXISTS — rename did not run`
    : `  ✓ message_logs.whatsapp_message_id is gone (renamed)`,
);

console.log(
  allPresent && !oldColumn.ok
    ? "\nMigration 0008 is fully applied. Safe to deploy."
    : "\nMigration 0008 is NOT fully applied. Do NOT deploy yet.",
);
process.exit(allPresent && !oldColumn.ok ? 0 : 1);
