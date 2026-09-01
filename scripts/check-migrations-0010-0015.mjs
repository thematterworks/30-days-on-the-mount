// Read-only: reports which of migrations 0010-0015 are applied to the live
// database, so an unguarded migration is never re-run against a schema that
// already has it. Same probe technique and .env.local handling as
// check-migration-0009.mjs. Prints only pass/fail and row counts — never
// secrets, never participant data.
//
// Usage: node scripts/check-migrations-0010-0015.mjs

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
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

async function columnExists(table, column) {
  const response = await fetch(`${origin}/rest/v1/${table}?select=${column}&limit=0`, { headers });
  if (response.ok) return { ok: true };
  const payload = await response.json().catch(() => null);
  return { ok: false, error: payload?.message ?? `HTTP ${response.status}` };
}

/** Exact row count for a PostgREST filter, via the Content-Range header. */
async function countWhere(table, filter) {
  const response = await fetch(`${origin}/rest/v1/${table}?${filter}&select=*&limit=0`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    return { ok: false, error: payload?.message ?? `HTTP ${response.status}` };
  }
  const range = response.headers.get("content-range") ?? "";
  return { ok: true, count: Number(range.split("/")[1] ?? "0") };
}

const columnChecks = [
  ["0010", "curriculum_days", "hook_text"],
  ["0010", "curriculum_days", "scripture_reference"],
  ["0010", "curriculum_days", "exegesis_text"],
  ["0010", "curriculum_days", "surrender_text"],
  ["0012", "community_reflections", "id"],
  ["0013", "curriculum_days", "teaching_video_url"],
  ["0015", "users", "last_push_on"],
];

console.log(`Checking migrations 0010-0015 against ${origin}\n`);

const applied = {};
for (const [migration, table, column] of columnChecks) {
  const result = await columnExists(table, column);
  applied[migration] = (applied[migration] ?? true) && result.ok;
  console.log(`  ${result.ok ? "✓" : "✗"} [${migration}] ${table}.${column}${result.ok ? "" : ` — ${result.error}`}`);
}

// 0011 and 0014 are data backfills, not schema changes — probe for leftover
// rows the migration would have rewritten rather than for a column.
const notPremium = await countWhere("users", "access_tier=neq.premium");
console.log(
  notPremium.ok
    ? `  ${notPremium.count === 0 ? "✓" : "✗"} [0011] users with access_tier <> 'premium': ${notPremium.count}`
    : `  ? [0011] could not count — ${notPremium.error}`,
);

const stillSeven = await countWhere("users", "preferred_delivery_hour=eq.7&status=neq.pending");
console.log(
  stillSeven.ok
    ? `  ${stillSeven.count === 0 ? "✓" : "✗"} [0014] non-pending users still on hour 7: ${stillSeven.count}`
    : `  ? [0014] could not count — ${stillSeven.error}`,
);

const total = await countWhere("users", "id=not.is.null");
if (total.ok) console.log(`\n  (total user rows: ${total.count})`);

console.log("\n✓ = already applied, ✗ = still needs applying.");
