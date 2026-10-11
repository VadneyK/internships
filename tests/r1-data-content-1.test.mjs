import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SENATE = JSON.parse(fs.readFileSync(new URL("../data/programs/us-senate-youth-program.json", import.meta.url), "utf8"));
const ENTRY = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8")).find((e) => e.id === "us-senate-youth-program");

test("Senate Youth card is closed (its 2027 deadline has passed) and does not say 'today'", () => {
  for (const card of [SENATE, ENTRY]) {
    assert.equal(card.status, "closed-expect-reopen");
    assert.equal(card.deadline_iso, null);
    assert.ok(!/\btoday\b/i.test(card.deadline_text), "deadline_text must not say today");
  }
});

// Multi-city cards are listed under every region their own city text names.
const REGION_ADDS = {
  "habitat-east-bay-silicon-valley-volunteer": ["fremont", "san-jose"],
  "inova-high-school-student-volunteers": ["virginia"],
  "fairfax-eye-summer-work-experience": ["virginia"],
  "kode-with-klossy": ["oakland"],
  "massachusetts-umass-amherst-pre-college": ["boston"],
  "ebrpd-student-jobs": ["alameda"],
  "michigan-ymca-youth-in-government": ["lansing"],
};

test("multi-city cards list every region their city text names", () => {
  const entries = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
  for (const [id, slugs] of Object.entries(REGION_ADDS)) {
    const file = JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
    const entry = entries.find((e) => e.id === id);
    assert.ok(entry, `${id} missing from entries.json`);
    for (const slug of slugs) {
      assert.ok(file.regions.includes(slug), `${id} program file lacks ${slug}`);
      assert.ok(entry.regions.includes(slug), `${id} entries.json lacks ${slug}`);
    }
  }
});

test("Michigan Boys State stays in Michigan only (session is in Hillsdale)", () => {
  const file = JSON.parse(fs.readFileSync(new URL("../data/programs/michigan-american-legion-boys-state.json", import.meta.url), "utf8"));
  assert.deepEqual(file.regions, ["michigan"]);
});
