// One-off: sends a single approved WhatsApp template to a specific test
// number, to confirm the webhook/reply flow end-to-end. Not part of the
// app — a diagnostic script only.
//
// Credentials read from .env.local (gitignored), same pattern as the other
// scripts/ files — nothing hardcoded, nothing printed.
//
// Usage: node scripts/send-test-template.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const TO = "13109028045";
const TEMPLATE_NAME = "day_01_poor_in_spirit";
const LANGUAGE = "en_US";
const GRAPH_API_VERSION = "v19.0"; // matches lib/whatsapp.ts, the app's own production sender

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

const phoneNumberId = readEnvLocal("WHATSAPP_PHONE_NUMBER_ID");
const accessToken = readEnvLocal("META_ACCESS_TOKEN");

if (!phoneNumberId || !accessToken) {
  console.error("Missing WHATSAPP_PHONE_NUMBER_ID or META_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

console.log(`Sending "${TEMPLATE_NAME}" to ${TO} via phone_number_id ${phoneNumberId}...`);

const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    messaging_product: "whatsapp",
    to: TO,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: LANGUAGE },
    },
  }),
});

const result = await response.json().catch(() => null);

if (!response.ok) {
  console.error("✗ REJECTED:", JSON.stringify(result?.error ?? result, null, 2));
  process.exit(1);
}

console.log("✓ SENT:", JSON.stringify(result, null, 2));
