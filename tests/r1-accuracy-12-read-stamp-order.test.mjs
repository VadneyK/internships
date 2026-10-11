// No page's "Last read" stamp may be older than a "read <date>" or "checked <date>"
// written inside the same file (ticket r1-accuracy-12). Stamps are typed by hand,
// so a later note can add a newer date and leave the page stamp behind.
// Pages: src/*.html stamp is the "Last read ... Mon D, 2026" text.
// Data: data/*.json stamp is the top-level "read" field.
// Run with: node --test tests/r1-accuracy-12-read-stamp-order.test.mjs
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

// The file's own stamp: "Last read ... Mon D, 2026" for pages, the top-level "read" field for json.
function stampOf(rel, text) {
  if (rel.endsWith(".json")) {
    const m = JSON.parse(text).read?.match(new RegExp(`^${STAMP_DATE}$`));
    return m ? toIso(m[1], m[2], m[3]) : null;
  }
  const m = text.match(new RegExp(`Last read[^<]{0,80}?${STAMP_DATE}`));
  return m ? toIso(m[1], m[2], m[3]) : null;
}

// Every "read Mon D, 2026" or "checked Mon D, 2026" in the file, with an optional "on".
function innerDates(text) {
  const out = [];
  for (const m of text.matchAll(new RegExp(`\\b(?:read|checked)(?: on)? ${STAMP_DATE}`, "g"))) {
    out.push({ date: toIso(m[1], m[2], m[3]), text: m[0] });
  }
  return out;
}

const FILES = [
  "src/rules.html",
  "src/paycheck.html",
  "src/states.html",
  "src/younger.html",
  "src/interview.html",
  "src/languages.html",
  "data/money.json",
  "data/younger.json",
  "data/interview.json",
  "data/transit.json",
  "data/languages.json",
  "data/permits.json",
];

test("every file lists a Last read stamp that can be parsed", () => {
  for (const rel of FILES) {
    assert.ok(stampOf(rel, read(rel)), `${rel} has no parsable stamp`);
  }
});

for (const rel of FILES) {
  test(`${rel}: stamp is not older than any read or checked date inside it`, () => {
    const text = read(rel);
    const stamp = stampOf(rel, text);
    assert.ok(stamp, `${rel} has no parsable stamp`);
    const late = innerDates(text).filter((d) => d.date > stamp);
    assert.deepEqual(
      late.map((d) => `"${d.text}" is newer than the stamp ${stamp}`),
      [],
      `${rel}: update the stamp so it is the newest read date`,
    );
  });
}
