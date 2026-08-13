// Generates short, Meta-compliant WhatsApp template bodies from the full
// curriculum content in 30_Day_Curriculum.csv — the "short teaser +
// follow-up" approach: each template carries just the day's title,
// Today's Invitation, and Scripture, plus a reply-to-continue prompt. The
// full Synopsis/Key Practice content is sent as a freeform follow-up by the
// webhook once the participant replies (see the "wasLastTemplateToday"
// check added to app/api/webhook/whatsapp/route.ts).
//
// Writes scripts/generated-templates.json for review before
// create-templates.mjs submits anything to Meta.
//
// Usage: node scripts/generate-template-bodies.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const BODY_CHAR_LIMIT = 1024;
const NAME_PATTERN = /^[a-z0-9_]+$/;

function extractSection(fallbackText, label) {
  // The CSV uses a curly apostrophe in "Today's Invitation" - normalize first.
  const normalized = fallbackText.replace(/[‘’]/g, "'");
  const pattern = new RegExp(`\\*${label}:\\*\\s*([^*]+?)(?=\\n\\n\\*|$)`, "s");
  const match = normalized.match(pattern);
  return match ? match[1].trim() : null;
}

function clean(text) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function buildShortBody(row) {
  const invitation = extractSection(row.fallback_text, "Today's Invitation");
  const scripture = extractSection(row.fallback_text, "Scripture");

  if (!invitation || !scripture) {
    throw new Error(`Day ${row.day_number}: could not extract Invitation/Scripture from fallback_text`);
  }

  const title = clean(row.title.replace(/^Day\s+\d+:\s*/, ""));

  // Single \n between sections — WhatsApp template bodies reject more than
  // one consecutive newline, so no blank-line paragraph spacing here.
  return [
    `Day ${row.day_number}: ${title}`,
    `Today's Invitation: ${clean(invitation)}`,
    `Scripture: ${clean(scripture)}`,
    `Reply here to receive today's full reflection.`,
  ].join("\n");
}

const csvPath = join(rootDir, "30_Day_Curriculum.csv");
const records = parse(readFileSync(csvPath, "utf8"), { columns: true, skip_empty_lines: true });

const templates = [];
const problems = [];

for (const row of records) {
  const dayNumber = Number(row.day_number);
  const name = row.meta_template_name;

  let body;
  try {
    body = buildShortBody(row);
  } catch (error) {
    problems.push(`Day ${dayNumber}: ${error.message}`);
    continue;
  }

  const rowProblems = [];
  if (!NAME_PATTERN.test(name)) rowProblems.push(`template name "${name}" has invalid characters (must be lowercase a-z, 0-9, _)`);
  if (body.length > BODY_CHAR_LIMIT) rowProblems.push(`body is ${body.length} chars, over the ${BODY_CHAR_LIMIT} limit`);
  if (/\n{2,}/.test(body)) rowProblems.push("body has consecutive newlines");

  if (rowProblems.length) {
    problems.push(`Day ${dayNumber} (${name}): ${rowProblems.join("; ")}`);
    continue;
  }

  templates.push({ day_number: dayNumber, name, body, char_count: body.length });
}

const outPath = join(__dirname, "generated-templates.json");
writeFileSync(outPath, JSON.stringify(templates, null, 2));

console.log(`Generated ${templates.length} of ${records.length} template bodies -> scripts/generated-templates.json`);
if (problems.length) {
  console.log(`\n${problems.length} row(s) had problems and were skipped:`);
  for (const p of problems) console.log(`  - ${p}`);
}

const lengths = templates.map((t) => t.char_count);
console.log(`\nBody length: min ${Math.min(...lengths)}, max ${Math.max(...lengths)}, avg ${Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)}`);
console.log("\n--- Sample (Day 1) ---");
console.log(templates[0]?.body);
