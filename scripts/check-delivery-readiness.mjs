// Read-only: verifies the live database is in the state automated delivery
// requires. Checks schema (columns, defaults, enums) via PostgREST's OpenAPI
// spec — which reports column defaults and comments, so a `set default` is
// actually verifiable rather than merely assumed — then the per-participant
// state daily-push depends on.
//
// Prints counts, and per-participant rows with the phone number masked. Never
// prints secrets or message content.
//
// Usage: node scripts/check-delivery-readiness.mjs

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
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
};

console.log(`Delivery readiness for ${origin}\n`);

// ---------- schema, from the OpenAPI spec ----------
const spec = await (await fetch(`${origin}/rest/v1/`, { headers })).json();
const columnsOf = (table) => spec?.definitions?.[table]?.properties ?? {};
const users = columnsOf("users");

console.log("Schema");
for (const [migration, table, column] of [
  ["0010", "curriculum_days", "hook_text"],
  ["0010", "curriculum_days", "surrender_text"],
  ["0012", "community_reflections", "id"],
  ["0013", "curriculum_days", "teaching_video_url"],
  ["0015", "users", "last_push_on"],
]) {
  check(columnsOf(table)[column] !== undefined, `[${migration}] ${table}.${column} exists`);
}
check(users.channel?.default === "sms", "[0016] users.channel default is 'sms'", `default=${JSON.stringify(users.channel?.default)}`);
const messageLogs = columnsOf("message_logs");
check(messageLogs.channel?.default === "sms", "[0016] message_logs.channel default is 'sms'", `default=${JSON.stringify(messageLogs.channel?.default)}`);

// ---------- data ----------
async function countWhere(table, filter) {
  const response = await fetch(`${origin}/rest/v1/${table}?${filter}&select=*&limit=0`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  return Number((response.headers.get("content-range") ?? "").split("/")[1] ?? "0");
}

console.log("\nData");
check((await countWhere("users", "channel=eq.whatsapp")) === 0, "[0016] no users left on channel='whatsapp'");
check((await countWhere("users", "access_tier=neq.premium")) === 0, "[0011] all users are premium");
check((await countWhere("users", "preferred_delivery_hour=eq.7&status=neq.pending")) === 0, "[0014] no non-pending users left on hour 7");
check(
  (await countWhere("users", "status=eq.active&last_push_on=is.null")) === 0,
  "[0015] every active user has last_push_on set",
  "null would make them look never-pushed and send immediately",
);

// ---------- per-participant delivery state ----------
const rows = await (
  await fetch(
    `${origin}/rest/v1/users?select=phone_number,status,current_day,channel,timezone,preferred_delivery_hour,last_push_on&order=phone_number`,
    { headers },
  )
).json();

const localPart = (tz, opts) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...opts });
const now = new Date();

console.log("\nParticipants");
for (const row of rows) {
  const tz = row.timezone || "America/Los_Angeles";
  const hour = Number(localPart(tz, { hour: "numeric", hour12: false }).format(now));
  const date = localPart(tz, { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const masked = `***${String(row.phone_number).slice(-4)}`;
  const pushedToday = row.last_push_on === date;
  console.log(
    `  ${masked}  status=${row.status} day=${row.current_day} ch=${row.channel} tz=${tz} ` +
      `hour=${String(row.preferred_delivery_hour ?? "null(->8)")} localNow=${date} ${String(hour).padStart(2, "0")}h ` +
      `last_push_on=${row.last_push_on ?? "null"}${pushedToday ? " (already pushed today)" : ""}`,
  );
}

console.log(`\n${failures === 0 ? "READY — all checks passed." : `NOT READY — ${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
