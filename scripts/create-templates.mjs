// Bulk-creates WhatsApp message templates from scripts/generated-templates.json
// (produced by generate-template-bodies.mjs) against the Meta Graph API.
//
// Credentials are never hardcoded here. Two ways to supply them, checked in
// this order:
//   1. Already-set environment variables META_WABA_ID / META_ACCESS_TOKEN
//      (e.g. `export`ed in an interactive shell — note this only works if
//      the script actually runs *in* that same shell process; it will not
//      pick up a var exported in a different terminal/session).
//   2. META_WABA_ID / META_ACCESS_TOKEN lines in .env.local (gitignored),
//      read directly by this script — nothing printed, nothing echoed.
//
// Usage:
//   node scripts/create-templates.mjs [--dry-run]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function readFromEnvLocal(key) {
  try {
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
  } catch {
    // .env.local missing entirely — fine, just means this source has nothing to offer.
  }
  return undefined;
}

const GRAPH_API_VERSION = "v20.0";
const CATEGORY = "MARKETING";
const LANGUAGE = "en_US";
const DELAY_BETWEEN_REQUESTS_MS = 750;

const dryRun = process.argv.includes("--dry-run");
const wabaId = process.env.META_WABA_ID || readFromEnvLocal("META_WABA_ID");
const accessToken = process.env.META_ACCESS_TOKEN || readFromEnvLocal("META_ACCESS_TOKEN");

if (!dryRun && (!wabaId || !accessToken)) {
  console.error(
    "Missing META_WABA_ID / META_ACCESS_TOKEN. Set them as env vars in this exact shell, or add them to .env.local (or pass --dry-run).",
  );
  process.exit(1);
}

const templates = JSON.parse(readFileSync(join(__dirname, "generated-templates.json"), "utf8"));
console.log(`Loaded ${templates.length} templates from generated-templates.json.\n`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let succeeded = 0;
let failed = 0;
const failures = [];

for (const template of templates) {
  const payload = {
    name: template.name,
    language: LANGUAGE,
    category: CATEGORY,
    components: [{ type: "BODY", text: template.body }],
  };

  if (dryRun) {
    console.log(`[DRY RUN] Day ${template.day_number} (${template.name}): would submit ${template.char_count} chars`);
    continue;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      failed += 1;
      const errorDetail = result?.error ?? result;
      failures.push({ day: template.day_number, name: template.name, error: errorDetail });
      console.error(`✗ Day ${template.day_number} (${template.name}): REJECTED —`, JSON.stringify(errorDetail));
    } else {
      succeeded += 1;
      console.log(`✓ Day ${template.day_number} (${template.name}): id=${result.id}, status=${result.status}`);
    }
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ day: template.day_number, name: template.name, error: message });
    console.error(`✗ Day ${template.day_number} (${template.name}): request threw —`, message);
  }

  await sleep(DELAY_BETWEEN_REQUESTS_MS);
}

console.log("\n--- Summary ---");
if (dryRun) {
  console.log(`${templates.length} templates would be submitted. Re-run without --dry-run to actually submit.`);
} else {
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  Day ${f.day} (${f.name}):`, JSON.stringify(f.error));
    }
  }
}
