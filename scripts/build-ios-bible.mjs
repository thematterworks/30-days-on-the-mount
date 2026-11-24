// Builds ios/Mount/Resources/BSB.sqlite — the Berean Standard Bible, bundled
// with the app so reading and search work instantly and offline.
//
// SOURCE: the canonical BSB "translation tables" workbook from bereanbible.com
// (bsb_tables.xlsx, sheet "biblosinterlinear96"). The BSB is in the public
// domain. The sheet is ONE ROW PER ORIGINAL-LANGUAGE TOKEN; English verse text
// is reconstructed from those rows.
//
// The parsing rules are taken verbatim from Qara Bible's proven ingest script
// (qara_bible/scripts/ingestBSB.ts): read columns by header name, carry the
// sparse VerseId forward across continuation rows, order English fragments by
// "BSB Sort", wrap each in its begQ/pnc/endQ columns, and tidy spacing before
// punctuation. Matching it exactly means the two apps render identical text.
//
// OUTPUT schema:
//   books(id, name, testament, chapters)
//   verses(rowid, book, chapter, verse, text)   unique (book, chapter, verse)
//   verses_fts — FTS5 over verses.text, for instant search
//
// Usage — needs the `xlsx` package, either installed here (`npm i --no-save xlsx`)
// or pointed at with XLSX_MODULE, e.g. Qara's copy:
//   XLSX_MODULE=~/Downloads/qara_bible/node_modules/xlsx \
//     node scripts/build-ios-bible.mjs ~/Downloads/bsb_tables.xlsx

import { readFileSync, rmSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const XLSX = createRequire(import.meta.url)(process.env.XLSX_MODULE ?? "xlsx");

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-ios-bible.mjs <path/to/bsb_tables.xlsx>");
  process.exit(1);
}
const output = join(rootDir, "ios/Mount/Resources/BSB.sqlite");

// Canonical Protestant order — identical to Qara's BOOK_NAME_TO_ID.
const BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
  "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah",
  "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians",
  "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
  "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
];
const BOOK_ID = new Map(BOOKS.map((name, index) => [name, index + 1]));
const BOOK_ALIASES = { "Psalm": "Psalms", "Song of Songs": "Song of Solomon", "Canticles": "Song of Solomon", "Revelation of John": "Revelation" };

const COL = { vref: "VerseId", surface: "BSB version", bsbSort: "BSB Sort", begQ: "begQ", pnc: "pnc", endQ: "endQ" };

const VREF_RE = /^(.+?)\s+(\d+):(\d+)$/;
function parseVref(vref) {
  const match = VREF_RE.exec((vref || "").trim());
  if (!match) return null;
  const raw = match[1].trim();
  return { book: BOOK_ALIASES[raw] ?? raw, chapter: Number(match[2]), verse: Number(match[3]) };
}

function reconstructText(parts) {
  return parts
    .join(" ")
    .replace(/\s+([,.;:!?'"’”)\]])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Qara's cleanVerseText (qara_bible/src/utils/index.ts), applied once here at
// build time instead of on every render. The raw tables carry editorial
// markers: [brackets] around supplied words (kept, brackets dropped), "-" for
// untranslated original-language tokens, "vvv" verb placeholders, and
// dot-leaders. Order matters; genuine "..." ellipses and in-word hyphens survive.
function cleanVerseText(text) {
  return text
    .replace(/[\[\]]/g, "")
    .replace(/vvv/gi, "")
    .replace(/\.{4,}/g, "")
    .replace(/(?:\s+-+)+(?=\s|[.,;:!?]|$)/g, "")
    .replace(/^\s*-+\s+/, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

console.log(`Reading ${input} (${(statSync(input).size / 1e6).toFixed(1)} MB)…`);
const workbook = XLSX.read(readFileSync(input), { type: "buffer" });
const sheet = workbook.Sheets.biblosinterlinear96;
if (!sheet) throw new Error(`Sheet "biblosinterlinear96" not found. Sheets: ${workbook.SheetNames.join(", ")}`);
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: false });
const header = (matrix.shift() ?? []).map((h) => String(h ?? "").trim());
const index = Object.fromEntries(Object.entries(COL).map(([key, name]) => [key, header.indexOf(name)]));
for (const [key, position] of Object.entries(index)) {
  if (position === -1) throw new Error(`Column "${COL[key]}" not found. Header: ${header.join(" | ")}`);
}
console.log(`  ${matrix.length.toLocaleString()} token rows`);

// Group tokens by verse, carrying the sparse VerseId forward.
const verses = new Map();
const unmappedBooks = new Set();
let last = null;
let unparsed = 0;
for (const cells of matrix) {
  const cell = (key) => String(cells[index[key]] ?? "").trim();
  let parsed = parseVref(cell("vref"));
  if (!parsed) {
    if (cell("vref")) { unparsed++; continue; }
    if (!last) continue;
    parsed = last;
  } else {
    last = parsed;
  }
  const bookId = BOOK_ID.get(parsed.book);
  if (!bookId) { unmappedBooks.add(parsed.book); continue; }

  const key = `${bookId}:${parsed.chapter}:${parsed.verse}`;
  let acc = verses.get(key);
  if (!acc) {
    acc = { book: bookId, chapter: parsed.chapter, verse: parsed.verse, tokens: [] };
    verses.set(key, acc);
  }
  const sortRaw = cell("bsbSort");
  acc.tokens.push({
    row: acc.tokens.length,
    sort: sortRaw && /\d/.test(sortRaw) ? Number(sortRaw) : null,
    visible: `${cell("begQ")}${cell("surface")}${cell("pnc")}${cell("endQ")}`,
  });
}

// Build the database.
rmSync(output, { force: true });
const db = new DatabaseSync(output);
db.exec(`
  PRAGMA journal_mode = OFF;
  PRAGMA page_size = 4096;
  CREATE TABLE books (id INTEGER PRIMARY KEY, name TEXT NOT NULL, testament TEXT NOT NULL, chapters INTEGER NOT NULL);
  CREATE TABLE verses (book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, text TEXT NOT NULL);
  CREATE UNIQUE INDEX verses_ref ON verses (book, chapter, verse);
  CREATE VIRTUAL TABLE verses_fts USING fts5 (text, content = 'verses', content_rowid = 'rowid', tokenize = 'porter unicode61');
`);

const insertVerse = db.prepare("INSERT INTO verses (book, chapter, verse, text) VALUES (?, ?, ?, ?)");
const ordered = [...verses.values()].sort((a, b) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse);
const chapters = new Map();
let empty = 0;
db.exec("BEGIN");
for (const acc of ordered) {
  const reading = [...acc.tokens].sort((a, b) => {
    if (a.sort != null && b.sort != null) return a.sort - b.sort;
    if (a.sort != null) return -1;
    if (b.sort != null) return 1;
    return a.row - b.row;
  });
  const text = cleanVerseText(reconstructText(reading.map((t) => t.visible).filter(Boolean)));
  if (!text) { empty++; continue; }
  insertVerse.run(acc.book, acc.chapter, acc.verse, text);
  chapters.set(acc.book, Math.max(chapters.get(acc.book) ?? 0, acc.chapter));
}
const insertBook = db.prepare("INSERT INTO books (id, name, testament, chapters) VALUES (?, ?, ?, ?)");
BOOKS.forEach((name, i) => insertBook.run(i + 1, name, i < 39 ? "OT" : "NT", chapters.get(i + 1) ?? 0));
db.exec("COMMIT");
db.exec("INSERT INTO verses_fts (verses_fts) VALUES ('rebuild'); INSERT INTO verses_fts (verses_fts) VALUES ('optimize'); VACUUM;");

// Report, with spot checks a reader would notice immediately.
const count = db.prepare("SELECT COUNT(*) AS n FROM verses").get().n;
const verse = (book, chapter, number) =>
  db.prepare("SELECT text FROM verses WHERE book = ? AND chapter = ? AND verse = ?").get(BOOK_ID.get(book), chapter, number)?.text;
console.log(`\nWrote ${output} (${(statSync(output).size / 1e6).toFixed(1)} MB)`);
console.log(`  ${count.toLocaleString()} verses in ${BOOKS.length} books; ${empty} empty; ${unparsed} unparsed refs; unmapped books: ${[...unmappedBooks].join(", ") || "none"}`);
console.log(`  Genesis 1:1  — ${verse("Genesis", 1, 1)}`);
console.log(`  Matthew 5:3  — ${verse("Matthew", 5, 3)}`);
console.log(`  John 3:16    — ${verse("John", 3, 16)}`);
console.log(`  Matthew 7:24 — ${verse("Matthew", 7, 24)}`);
console.log(`  Galatians 5:23 (hyphen kept) — ${verse("Galatians", 5, 23)}`);
const leftovers = db.prepare(`SELECT COUNT(*) AS n FROM verses WHERE text LIKE '%vvv%' OR text LIKE '%[%' OR text LIKE '% - %'`).get().n;
console.log(`  verses still carrying markers: ${leftovers}`);
const hits = db.prepare("SELECT COUNT(*) AS n FROM verses_fts WHERE verses_fts MATCH 'blessed'").get().n;
console.log(`  FTS "blessed": ${hits} verses`);
db.close();
