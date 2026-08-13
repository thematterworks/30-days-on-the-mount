// One-off data-load script: imports 30_Day_Curriculum.csv into curriculum_days
// (day_number 1-31). Day 0 is left untouched — the CSV doesn't include it,
// and it's already seeded separately as the onboarding welcome message.
//
// Requires migration 0007 (widens curriculum_days.day_number to 0-31) to
// have been applied first, or the day-31 upsert will fail its CHECK
// constraint.
//
// Usage: node scripts/import-curriculum.mjs [--dry-run]
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local (not
// committed, never hardcoded here).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function loadEnvLocal() {
  const envPath = join(rootDir, ".env.local");
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2];
    // Strip a single layer of matching surrounding quotes, same as
    // dotenv/Next.js's own .env parsing does — without this, a quoted
    // value like SUPABASE_URL="https://...supabase.co/v1/" keeps its
    // literal quote characters, which supabase-js then rejects outright.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const dryRun = process.argv.includes("--dry-run");
const env = loadEnvLocal();

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// .env.local's SUPABASE_URL is stored as the full REST endpoint
// (".../rest/v1/") rather than the bare project URL — createClient() wants
// just the origin, since it appends /rest/v1/, /auth/v1/, etc. itself.
// Normalizing here rather than editing .env.local, since this has never
// actually been exercised locally before (all prior local runs used
// placeholder env overrides) and production's Vercel-configured value has
// clearly been correct this whole time.
const supabaseUrl = new URL(env.SUPABASE_URL).origin;

const csvPath = join(rootDir, "30_Day_Curriculum.csv");
const records = parse(readFileSync(csvPath, "utf8"), { columns: true, skip_empty_lines: true });

const rows = records.map((row) => {
  const dayNumber = Number(row.day_number);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
    throw new Error(`Unexpected day_number in CSV: ${row.day_number}`);
  }
  return {
    day_number: dayNumber,
    title: row.title,
    template_name: row.meta_template_name,
    fallback_text: row.fallback_text,
    ai_guidance_prompt: row.ai_guidance ?? "",
  };
});

console.log(`Parsed ${rows.length} rows from 30_Day_Curriculum.csv (day_number ${Math.min(...rows.map((r) => r.day_number))}-${Math.max(...rows.map((r) => r.day_number))}).`);

if (dryRun) {
  console.log("--dry-run: not writing to Supabase. Sample row:");
  console.log(JSON.stringify(rows[0], null, 2));
  process.exit(0);
}

const supabase = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase.from("curriculum_days").upsert(rows, { onConflict: "day_number" }).select("day_number");

if (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
}

console.log(`Upserted ${data.length} curriculum_days rows: ${data.map((r) => r.day_number).sort((a, b) => a - b).join(", ")}`);
