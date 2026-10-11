// Ticket r1-accuracy-7: the languages note does not overclaim, and the California
// wage row names both the 2026 rate and the Jan 1, 2027 rate from permits.json.
// Run with: node --test tests/r1-accuracy-7.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => JSON.parse(fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"));
const languages = read("data/languages.json");
const permits = read("data/permits.json");

test("languages note says the pages are official and names the I-9 translation guide", () => {
  assert.match(languages.note, /^These are official pages from the agencies listed\. The English version is the official one, and the I-9 row is a translation guide only\./);
  assert.doesNotMatch(languages.note, /official translations/);
});

test("the I-9 row is the one that says it is a translation guide only", () => {
  const i9 = languages.rows.find((r) => /Form I-9/.test(r.title));
  assert.ok(i9, "no Form I-9 row");
  assert.match(i9.covers, /translation guide only/);
});

test("California minimum wage row shows the 2026 rate and the Jan 1, 2027 rate", () => {
  const row = languages.rows.find((r) => r.state === "California" && /minimum wage/i.test(r.title));
  assert.ok(row, "no California minimum wage row");
  assert.equal(row.covers, "$16.90 an hour in 2026, $17.40 from Jan 1, 2027");
  assert.match(permits.states.ca.wage, /\$17\.40 from Jan 1, 2027/);
});
