// Builds ios/Mount/Resources/SampleCurriculum.json from 30_Day_Curriculum.csv
// (all 31 days) plus the hand-authored guided-story content in
// seed-day-11.mjs. The iOS app bundles this as its offline/preview content
// source until the mobile API is live, so it is generated from the real
// curriculum rather than invented.
//
// Each CSV body is a fixed four-section document — "Today's Invitation",
// "Scripture", "Synopsis", "Key Practice" — present on every day, which maps
// onto the guided story's screens. Days whose richer guided-story fields
// exist (currently day 11) override that mapping.
//
// Usage: node scripts/export-ios-sample-curriculum.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "csv-parse/sync";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const rows = parse(readFileSync(join(rootDir, "30_Day_Curriculum.csv"), "utf8"), {
  columns: true,
  skip_empty_lines: true,
});

/** Text between `*<heading>:*` and the next `*Heading:*` or the `. . .` rule. */
function section(body, heading) {
  const start = body.indexOf(`*${heading}:*`);
  if (start === -1) return "";
  const after = body.slice(start + heading.length + 3);
  const end = after.search(/\n\s*\*[^*\n]{2,40}:\*|\n\s*\. \. \./);
  return (end === -1 ? after : after.slice(0, end)).trim();
}

/** Splits `"quote" (Matthew 5:3)` into its text and reference. */
function splitScripture(raw) {
  const match = raw.match(/^([\s\S]*?)\s*\(([^()]+\d[^()]*)\)\s*$/);
  const text = (match ? match[1] : raw).trim().replace(/^["“]|["”]$/g, "");
  return { text, reference: match ? match[2].trim() : "" };
}

/** WhatsApp-style _italics_ -> plain text; the app styles text itself. */
const plain = (s) => s.replace(/_([^_]+)_/g, "$1").replace(/\*([^*]+)\*/g, "$1");

// seed-day-11.mjs PATCHes the live database when run, so it is read as text
// and only its `content` object literal is evaluated — never executed.
const seedSource = readFileSync(join(rootDir, "scripts/seed-day-11.mjs"), "utf8");
const literal = seedSource.match(/const content = (\{[\s\S]*?\n\});/);
if (!literal) throw new Error("Could not find the content literal in seed-day-11.mjs");
const day11 = new Function(`return (${literal[1]});`)();
const guidedOverrides = { 11: day11 };

const days = rows.map((row) => {
  const dayNumber = Number(row.day_number);
  const body = row.fallback_text;
  const scripture = splitScripture(section(body, "Scripture"));
  const override = guidedOverrides[dayNumber] ?? {};

  return {
    dayNumber,
    title: row.title.replace(/^Day\s+\d+:\s*/, "").trim(),
    hookText: plain(override.hook_text ?? section(body, "Today’s Invitation")),
    scriptureReference: override.scripture_reference ?? scripture.reference,
    scriptureText: plain(override.scripture_text ?? scripture.text),
    exegesisText: plain(override.exegesis_text ?? section(body, "Synopsis")),
    practiceTitle: plain(section(body, "Key Practice")),
    surrenderText: override.surrender_text ? plain(override.surrender_text) : null,
    teachingVideoURL: null,
    scriptureAudioURL: null,
    mediaURL: null,
  };
});

for (const day of days) {
  for (const field of ["title", "hookText", "scriptureReference", "scriptureText", "exegesisText", "practiceTitle"]) {
    if (!day[field]) throw new Error(`Day ${day.dayNumber} is missing ${field}`);
  }
}

const out = join(rootDir, "ios/Mount/Resources/SampleCurriculum.json");
writeFileSync(out, JSON.stringify(days, null, 2) + "\n");
console.log(`Wrote ${days.length} days to ${out}`);
console.log(`  with full guided-story content: ${days.filter((d) => d.surrenderText).map((d) => d.dayNumber).join(", ")}`);
