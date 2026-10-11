// The parents page says "Facts last read Oct 7 to Oct 10, 2026." It points to the
// paycheck and Rules pages, so its end date must not be earlier than the newest
// "last read" stamp on any page or data file it points to (ticket r4-accuracy-6).
// Pages: every "last read ... Mon D, 2026" in src/*.html (case-insensitive, all matches).
// Data: the top-level "read" field in data/*.json.
// Run with: node --test tests/r4-accuracy-6-parents-read-range.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
const STAMP_DATE = `${MON} (\\d{1,2}), (2026)`;

const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function toIso(mon, day, year) {
  const mo = MONTHS.indexOf(mon) + 1;
  return `${year}-${String(mo).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
}

// Every "last read" stamp in a page, as ISO dates.
function pageStamps(text) {
  const out = [];
  for (const m of text.matchAll(new RegExp(`last read[^<]{0,80}?${STAMP_DATE}`, "gi"))) {
    out.push(toIso(m[1], m[2], m[3]));
  }
  return out;
}

// The top-level "read" field of a data file, as an ISO date.
function jsonStamp(text) {
  const m = JSON.parse(text).read?.match(new RegExp(`^${STAMP_DATE}$`));
  return m ? toIso(m[1], m[2], m[3]) : null;
}

const PAGES = [
  "src/paycheck.html",
  "src/rules.html",
  "src/permit.html",
  "src/states.html",
  "src/younger.html",
  "src/languages.html",
];

const DATA = [
  "data/money.json",
  "data/permits.json",
  "data/younger.json",
  "data/languages.json",
];

const parentsText = read("src/parents.html");
const rangeMatch = parentsText.match(new RegExp(`Facts last read ${MON} (\\d{1,2}) to ${MON} (\\d{1,2}), (2026)\\.`));

test("parents page states a Facts last read range that can be parsed", () => {
  assert.ok(rangeMatch, "src/parents.html has no 'Facts last read Mon D to Mon D, 2026.' range");
});

const rangeStart = rangeMatch ? toIso(rangeMatch[1], rangeMatch[2], rangeMatch[5]) : null;
const rangeEnd = rangeMatch ? toIso(rangeMatch[3], rangeMatch[4], rangeMatch[5]) : null;

test("parents range start is not after its end", () => {
  assert.ok(rangeStart && rangeEnd, "range missing");
  assert.ok(rangeStart <= rangeEnd, `start ${rangeStart} is after end ${rangeEnd}`);
});

test("parents range end is not earlier than the newest stamp it points to", () => {
  assert.ok(rangeEnd, "range missing");
  const stamps = [];
  for (const rel of PAGES) {
    const found = pageStamps(read(rel));
    assert.ok(found.length > 0, `${rel} has no 'last read' stamp`);
    for (const d of found) stamps.push({ rel, date: d });
  }
  for (const rel of DATA) {
    const d = jsonStamp(read(rel));
    assert.ok(d, `${rel} has no parsable top-level read field`);
    stamps.push({ rel, date: d });
  }
  const newest = stamps.reduce((a, b) => (b.date > a.date ? b : a));
  assert.ok(
    rangeEnd >= newest.date,
    `parents range ends ${rangeEnd} but ${newest.rel} was read ${newest.date}`,
  );
});
