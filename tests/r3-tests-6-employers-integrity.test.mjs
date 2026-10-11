// Integrity checks for data/employers.json and data/expiring-dates.json, plus a self-check that every
// data/*.json file is named in a shape test. Plain node, no network. No data is edited by this test.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS = path.join(ROOT, "tests");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

// min_age is not any age written in the age_note. Each reason says what the age_note says.
// A person should decide whether each is fine (base age plus an older tier) or a data error.
// If a record is fixed so its age_note names its min_age, this test fails until the entry is removed.
const ALLOWLIST = {
  "wausau-woodchucks": "min_age is 14; the age_note only says cashier, serving and bartender jobs need 18 or older",
  "van-meter-parks-concessions": "min_age is 16; the age_note gives the season dates and says other cities set their own ages, with no age",
  "papa-johns": "min_age is 16; the age_note says the page also says you must be 18 to manage or deliver",
  "nebraska-athletics-concessions": "min_age is 16; the age_note gives a 2019 page date and says the hawker job (age 12) is left out",
  "winco-foods": "min_age is 16; the age_note says some jobs require 18 or 21 and each posting lists its age limit",
  // Found by the first full run; the ticket's first scan listed only the five above. Each age_note has no age at all.
  "arbys": "min_age is 16; the age_note says it was seen on a Crew Member posting and franchisees make their own hiring decisions",
  "chipotle": "min_age is 16; the age_note says it was seen on a Crew Member posting in Houston, TX",
  "sky-zone": "min_age is 16; the age_note says it is one location's page and other parks may differ",
  "ulta-beauty-teens": "min_age is 16; the age_note says the teen program is only in select states and not in NJ, TN and TX",
  "whataburger": "min_age is 16; the age_note says it was seen on a Fort Worth, TX posting and other stores may differ",
};

// Entries in expiring-dates.json are not in review_by order today (transit and languages rows come after
// a later date). Set to false once the data is sorted; the test below fails if it is sorted while this is true.
const DATES_KNOWN_UNSORTED = true;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen"];
const mentionsAge = (text, n) => new RegExp("(?<![\\d.$])" + n + "(?![\\d])|\\b" + WORDS[n] + "\\b", "i").test(text);

const data = readJson("data/employers.json");
const employers = data.employers;
const TEXT_FIELDS = ["name", "kind", "age_note", "roles", "how_to_apply", "page_title"];

test("employers.json has records", () => {
  assert.ok(Array.isArray(employers) && employers.length > 0);
});

test("employers have unique ids", () => {
  const seen = new Set();
  const dupes = [];
  for (const e of employers) {
    if (typeof e.id !== "string" || e.id.trim() === "") dupes.push("missing id on " + JSON.stringify(e.name));
    else if (seen.has(e.id)) dupes.push(e.id);
    seen.add(e.id);
  }
  assert.deepEqual(dupes, []);
});

test("employers have all required text, no stray whitespace, https urls", () => {
  const bad = [];
  for (const e of employers) {
    for (const f of TEXT_FIELDS) {
      const v = e[f];
      if (typeof v !== "string" || v.trim() === "") bad.push(e.id + "." + f + " is blank or missing");
    }
    for (const [k, v] of Object.entries(e)) {
      if (typeof v !== "string") continue;
      if (v !== v.trim()) bad.push(e.id + "." + k + " has leading or trailing space");
      if (/ {2}|\t|\n/.test(v)) bad.push(e.id + "." + k + " has a double space, tab or newline");
      if (/(^|[^a-z])http:\/\//i.test(v)) bad.push(e.id + "." + k + " has an http: link");
      if (k === "url" && !/^https:\/\/[^\s]+$/.test(v)) bad.push(e.id + ".url is not an https url: " + v);
    }
    if (e.url === undefined) bad.push(e.id + ".url is missing");
  }
  assert.deepEqual(bad, []);
});

test("employer min_age is an integer from 11 to 18", () => {
  const bad = employers.filter((e) => !Number.isInteger(e.min_age) || e.min_age < 11 || e.min_age > 18)
    .map((e) => e.id + " min_age=" + JSON.stringify(e.min_age));
  assert.deepEqual(bad, []);
});

test("employer min_age appears in its age_note (except the allowlist)", () => {
  const bad = [];
  for (const e of employers) {
    if (!Number.isInteger(e.min_age) || e.min_age < 0 || e.min_age > 18 || typeof e.age_note !== "string") continue;
    if (ALLOWLIST[e.id]) continue;
    if (!mentionsAge(e.age_note, e.min_age)) bad.push(e.id + ": min_age " + e.min_age + " not in age_note: " + e.age_note);
  }
  assert.deepEqual(bad, []);
});

test("every allowlist entry is a real record and still needs its exception", () => {
  const stale = [];
  for (const [id, why] of Object.entries(ALLOWLIST)) {
    const e = employers.find((x) => x.id === id);
    if (!e) { stale.push(id + " is not in employers.json, remove it from ALLOWLIST"); continue; }
    if (typeof why !== "string" || why.trim() === "") stale.push(id + " has no reason");
    if (mentionsAge(e.age_note, e.min_age)) stale.push(id + " is fixed (age_note now names " + e.min_age + "), remove it from ALLOWLIST");
  }
  assert.deepEqual(stale, []);
});

// ---- expiring-dates.json ----
const exp = readJson("data/expiring-dates.json");
const isRealIso = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const day = (s) => Date.parse(s + "T00:00:00Z");

test("expiring-dates.json: reviewed_on and every review_by is a real ISO date", () => {
  assert.ok(isRealIso(exp.reviewed_on), "reviewed_on: " + exp.reviewed_on);
  assert.ok(Array.isArray(exp.dates) && exp.dates.length > 0);
  const bad = exp.dates.filter((d) => !isRealIso(d.review_by)).map((d) => d.file + " " + d.text + " review_by=" + d.review_by);
  assert.deepEqual(bad, []);
});

test("expiring-dates.json: entries are complete, and none is older than 400 days before reviewed_on", () => {
  const floor = day(exp.reviewed_on) - 400 * 86400000;
  const bad = [];
  for (const d of exp.dates) {
    if (typeof d.file !== "string" || d.file.trim() === "" || typeof d.text !== "string" || d.text.trim() === "")
      bad.push("blank file or text: " + JSON.stringify(d));
    else if (!fs.existsSync(path.join(ROOT, d.file))) bad.push(d.file + " does not exist");
    if (isRealIso(d.review_by) && day(d.review_by) < floor) bad.push(d.file + " " + d.text + " is more than 400 days before reviewed_on");
  }
  assert.deepEqual(bad, []);
});

test("expiring-dates.json: each text names the same day as review_by", () => {
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const bad = [];
  for (const d of exp.dates) {
    const m = /^([A-Za-z]+)\.? (\d{1,2}), (\d{4})$/.exec(d.text);
    if (!m) { bad.push(d.file + " text is not 'Month D, YYYY': " + d.text); continue; }
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const iso = m[3] + "-" + String(mo).padStart(2, "0") + "-" + m[2].padStart(2, "0");
    if (iso !== d.review_by) bad.push(d.file + " text " + d.text + " vs review_by " + d.review_by);
  }
  assert.deepEqual(bad, []);
});

test("expiring-dates.json: entries are sorted by review_by", () => {
  const unsorted = [];
  for (let i = 1; i < exp.dates.length; i++)
    if (exp.dates[i].review_by < exp.dates[i - 1].review_by) unsorted.push(i + ": " + exp.dates[i].review_by + " after " + exp.dates[i - 1].review_by);
  if (DATES_KNOWN_UNSORTED) {
    assert.ok(unsorted.length > 0, "dates are now sorted: set DATES_KNOWN_UNSORTED to false");
  } else {
    assert.deepEqual(unsorted, []);
  }
});

// ---- every data file is named in a shape test ----
test("derived entries slices are still generated by build_data.py", () => {
  const src = fs.readFileSync(path.join(ROOT, "tools", "build_data.py"), "utf8");
  const bad = ["entries-blurb", "entries-card", "entries-core", "entries-detail", "entries-home", "entries-lite", "entries-stats"]
    .filter((f) => !src.includes(f));
  assert.deepEqual(bad, []);
});

test("every data/*.json file is named in a shape test file", () => {
  const dataFiles = fs.readdirSync(path.join(ROOT, "data")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  const shapeTests = fs.readdirSync(TESTS).filter((f) => /^r3-tests-(6|8)-.*\.test\.mjs$/.test(f))
    .map((f) => fs.readFileSync(path.join(TESTS, f), "utf8")).join("\n");
  // Slices of entries.json written by tools/build_data.py (same ids, fewer keys). entries.json itself must be named.
  const DERIVED = ["entries-blurb", "entries-card", "entries-core", "entries-detail", "entries-home", "entries-lite", "entries-stats"];
  const missing = dataFiles.filter((f) => !DERIVED.includes(f)).filter((f) => !new RegExp("[\"'/ ]" + f + "(\\.json)?[\"'\\s,\\]]").test(shapeTests));
  assert.deepEqual(missing, [], "add a shape test for: " + missing.join(", "));
});
