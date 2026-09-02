// Applies the data half of migration 0016 (backfill users.channel to 'sms').
//
// The `alter column ... set default` statements in 0016 are DDL and still need
// to be run through the Supabase SQL editor. The backfill is a plain update,
// so it can be applied over PostgREST with the service role key. Idempotent:
// after a successful run no rows match, so re-running is a no-op. Prints only
// counts — never participant data.
//
// Usage: node scripts/apply-migration-0016.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvLocal(key) {
  for (const line of readFileSync(join(rootDir, ".env.local"), "utf8").split("\n")) {
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

async function countLegacy() {
  const response = await fetch(`${origin}/rest/v1/users?channel=eq.whatsapp&select=*&limit=0`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  return Number((response.headers.get("content-range") ?? "").split("/")[1] ?? "0");
}

const before = await countLegacy();
console.log(`Users still on channel='whatsapp' before: ${before}`);
if (before === 0) {
  console.log("Nothing to do — backfill already applied.");
  process.exit(0);
}

const response = await fetch(`${origin}/rest/v1/users?channel=eq.whatsapp`, {
  method: "PATCH",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({ channel: "sms" }),
});
if (!response.ok) {
  const payload = await response.json().catch(() => null);
  console.error("FAILED:", payload?.message ?? `HTTP ${response.status}`);
  process.exit(1);
}
console.log(`Updated ${(await response.json()).length} row(s) to channel = 'sms'.`);

const after = await countLegacy();
console.log(`Users still on channel='whatsapp' after: ${after}`);
process.exit(after === 0 ? 0 : 1);
