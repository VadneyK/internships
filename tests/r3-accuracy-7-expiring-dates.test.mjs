// Every future full date in teen text must be on the reviewed list in
// data/expiring-dates.json. After a listed date passes, the nearby text must
// say it was read, took effect or happened "since", or the text is stale.
// Set EXPIRY_TODAY=YYYY-MM-DD to pick the day (default is today).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE_RE = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.? \d{1,2}, 20\d\d/g;
const OK_WORDS = /\b(read|took effect|since)\b/i;

function iso(text) {
  const mo = MONTHS.indexOf(text.slice(0, 3).toLowerCase()) + 1;
  const [d, y] = text.match(/\d+/g);
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const list = JSON.parse(fs.readFileSync(path.join(root, "data/expiring-dates.json"), "utf8"));
const SCANNED = [
  ...fs.readdirSync(path.join(root, "src")).filter((f) => f.endsWith(".html")).map((f) => "src/" + f),
  ...["permits", "younger", "money", "interview", "transit", "languages"].map((n) => `data/${n}.json`),
];
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

function problems(today) {
  const out = [];
  const listed = new Map(list.dates.map((e) => [e.file + "|" + e.text, e]));
  for (const f of SCANNED) {
    const t = read(f);
    for (const m of t.matchAll(DATE_RE)) {
      if (iso(m[0]) > list.reviewed_on && !listed.has(f + "|" + m[0])) {
        out.push(`${f}: "${m[0]}" is a future date not in data/expiring-dates.json`);
      }
    }
  }
  for (const e of list.dates) {
    if (e.review_by !== iso(e.text)) out.push(`${e.file}: review_by for "${e.text}" must be ${iso(e.text)}`);
    const t = fs.existsSync(path.join(root, e.file)) ? read(e.file) : "";
    let idx = t.indexOf(e.text);
    if (idx < 0) {
      out.push(`${e.file}: listed date "${e.text}" is no longer in the file, remove it from the list`);
      continue;
    }
    if (e.review_by >= today) continue;
    while (idx >= 0) {
      const near = t.slice(Math.max(0, idx - 100), idx + e.text.length + 100);
      if (!OK_WORDS.test(near)) out.push(`${e.file}: "${e.text}" has passed (${e.review_by}) and the nearby text does not say read, took effect or since`);
      idx = t.indexOf(e.text, idx + 1);
    }
  }
  return out;
}

test("future dates in teen text are all on the reviewed expiry list, and none are stale", () => {
  const today = process.env.EXPIRY_TODAY || new Date().toISOString().slice(0, 10);
  assert.deepEqual(problems(today), []);
});

test("fake clock: on Jan 2, 2027 the Dec 31, 2026 line fails", () => {
  const p = problems("2027-01-02");
  assert.ok(p.some((x) => x.includes("transit.json") && x.includes("Dec 31, 2026")), p.join("\n"));
});

test("fake clock: on the baseline day the list passes", () => {
  assert.deepEqual(problems("2026-10-10"), []);
});
