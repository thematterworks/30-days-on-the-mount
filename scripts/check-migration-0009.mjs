// Read-only: confirms migration 0009 (access_tier + magic_links) is applied
// to the live database before we deploy code that depends on it. Same probe
// technique and .env.local handling as check-migration-0008.mjs.
//
// Usage: node scripts/check-migration-0009.mjs

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
const origin = new URL(rawUrl).origin;

async function columnExists(table, column) {
  const url = `${origin}/rest/v1/${table}?select=${column}&limit=0`;
  const response = await fetch(url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (response.ok) return { ok: true };
  const payload = await response.json().catch(() => null);
  return { ok: false, error: payload?.message ?? `HTTP ${response.status}` };
}

const checks = [
  ["users", "access_tier"],
  ["users", "premium_granted_at"],
  ["magic_links", "id"],
  ["magic_links", "token_hash"],
  ["magic_links", "expires_at"],
  ["magic_links", "consumed_at"],
];

console.log(`Checking migration 0009 against ${origin} ...\n`);

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

console.log(
  allPresent ? "\nMigration 0009 is fully applied. Safe to deploy." : "\nMigration 0009 is NOT fully applied. Do NOT deploy yet.",
);
process.exit(allPresent ? 0 : 1);
