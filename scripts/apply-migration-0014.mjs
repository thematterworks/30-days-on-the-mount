// Applies migration 0014 (align default delivery hour) to the live database.
//
// 0014 is a pure data backfill with no DDL, so it can be applied over
// PostgREST with the service role key rather than a SQL connection. It is
// idempotent: after a successful run no rows match the filter, so re-running
// is a no-op. Prints only counts — never participant data.
//
// Usage: node scripts/apply-migration-0014.mjs

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
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

// Mirrors the migration's WHERE clause exactly.
const filter = "preferred_delivery_hour=eq.7&status=neq.pending";

const before = await fetch(`${origin}/rest/v1/users?${filter}&select=*&limit=0`, {
  headers: { ...headers, Prefer: "count=exact" },
});
const beforeCount = Number((before.headers.get("content-range") ?? "").split("/")[1] ?? "0");
console.log(`Rows matching 0014's filter before: ${beforeCount}`);

if (beforeCount === 0) {
  console.log("Nothing to do — migration 0014 is already applied.");
  process.exit(0);
}

const response = await fetch(`${origin}/rest/v1/users?${filter}`, {
  method: "PATCH",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({ preferred_delivery_hour: 8 }),
});

if (!response.ok) {
  const payload = await response.json().catch(() => null);
  console.error("FAILED:", payload?.message ?? `HTTP ${response.status}`);
  process.exit(1);
}

const updated = await response.json();
console.log(`Updated ${updated.length} row(s) to preferred_delivery_hour = 8.`);

const after = await fetch(`${origin}/rest/v1/users?${filter}&select=*&limit=0`, {
  headers: { ...headers, Prefer: "count=exact" },
});
const afterCount = Number((after.headers.get("content-range") ?? "").split("/")[1] ?? "0");
console.log(`Rows matching 0014's filter after: ${afterCount}`);
process.exit(afterCount === 0 ? 0 : 1);
