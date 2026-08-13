// Read-only: checks Meta's approval status for all 31 curriculum templates
// (cross-referenced against scripts/generated-templates.json) plus the
// evening check-in template, without digging through WhatsApp Manager.
//
// Credentials read from .env.local (gitignored) — same pattern as the
// other scripts/ files.
//
// Usage: node scripts/check-template-status.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const GRAPH_API_VERSION = "v20.0";

function readEnvLocal(key) {
  const lines = readFileSync(join(rootDir, ".env.local"), "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match || match[1] !== key) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

const wabaId = readEnvLocal("META_WABA_ID");
const accessToken = readEnvLocal("META_ACCESS_TOKEN");

if (!wabaId || !accessToken) {
  console.error("Missing META_WABA_ID or META_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

async function fetchAllTemplates() {
  const all = [];
  let url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?limit=100&fields=name,language,status,category,rejected_reason,id`;

  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json();
    if (!response.ok) {
      console.error("Failed to list templates:", JSON.stringify(payload?.error ?? payload, null, 2));
      process.exit(1);
    }
    all.push(...payload.data);
    url = payload.paging?.next ?? null;
  }

  return all;
}

const generated = JSON.parse(readFileSync(join(__dirname, "generated-templates.json"), "utf8"));
const allTemplates = await fetchAllTemplates();
const byName = new Map(allTemplates.map((t) => [t.name, t]));

console.log(`Found ${allTemplates.length} total templates on this WABA. Checking the 31 curriculum templates:\n`);

const counts = {};
for (const { day_number, name } of generated.sort((a, b) => a.day_number - b.day_number)) {
  const match = byName.get(name);
  const status = match?.status ?? "NOT FOUND";
  counts[status] = (counts[status] ?? 0) + 1;

  const rejection = match?.rejected_reason && match.rejected_reason !== "NONE" ? ` (${match.rejected_reason})` : "";
  console.log(`Day ${String(day_number).padStart(2, " ")}  ${status.padEnd(10, " ")} ${name}${rejection}`);
}

console.log("\n--- Summary ---");
for (const [status, count] of Object.entries(counts)) {
  console.log(`${status}: ${count}`);
}

// Bonus: evening check-in template, if it exists on this WABA too.
const evening = byName.get("evening_check_in");
if (evening) {
  console.log(`\nevening_check_in: ${evening.status}${evening.rejected_reason && evening.rejected_reason !== "NONE" ? ` (${evening.rejected_reason})` : ""}`);
} else {
  console.log("\nevening_check_in: NOT FOUND on this WABA — remember this one still needs to be created/approved separately.");
}
