// The Spanish California minimum wage card in data/languages.json must only describe what the linked page shows.
// The DIR Spanish page gives $16.90 from Jan 1, 2026 and does not mention 2027, so the card points to the
// English Rules page for the 2027 rate (ticket r1-accuracy-14).
// Run with: node --test tests/r1-accuracy-14-languages-covers-vs-page.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const langs = JSON.parse(rd("data/languages.json"));
const expiring = JSON.parse(rd("data/expiring-dates.json"));
const row = langs.rows[11];

test("Spanish CA minimum wage card is the row under test", () => {
  assert.equal(row.url, "https://www.dir.ca.gov/dlse/spanish/California-Minimum-Wage.htm");
});

test("covers does not promise a dated 2027 rate the linked page does not show", () => {
  assert.ok(!row.covers.includes("Jan 1, 2027"), "covers still promises a Jan 1, 2027 date: " + row.covers);
  assert.ok(!row.covers.includes("$17.40"), "covers still states the 2027 rate: " + row.covers);
});

test("covers still states the $16.90 rate", () => {
  assert.ok(row.covers.includes("$16.90"), "covers lost $16.90: " + row.covers);
});

test("covers points to the English Rules page for the 2027 rate", () => {
  assert.equal(row.covers, "$16.90 an hour from Jan 1, 2026. The 2027 rate is on the English Rules page.");
  assert.ok(row.covers.includes("English Rules page"), "covers does not point to the English Rules page");
});

test("expiring-dates has no languages.json entry for a date the file no longer contains", () => {
  const stale = expiring.dates.filter((e) => e.file === "data/languages.json");
  for (const e of stale) {
    assert.ok(rd("data/languages.json").includes(e.text), "languages.json entry not in file: " + e.text);
  }
  assert.equal(stale.length, 0, "languages.json entry for Jan 1, 2027 should be removed");
});
