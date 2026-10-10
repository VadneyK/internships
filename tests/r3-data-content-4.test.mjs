import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r3-data-content-4.
// The eight cards that were still snippet-only were re-read on 2026-10-09. Each one is now
// either fetched (with the page it was read from) or still snippet-only with a note that
// names the error that blocked the read. meta.json must count the fetched cards correctly.

const IDS = [
  "california-4h",
  "california-partnership-academies",
  "chicago-park-district-recreation-leader-in-training",
  "chp-explorer-post-east-sacramento",
  "ebayc-volunteer-and-internships",
  "elk-grove-youth-commission",
  "livermore-area-youth-advisory-commission",
  "youth-spirit-artworks-berkeley",
];
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const ENTRIES = read("../data/entries.json");
const META = read("../data/meta.json");

for (const id of IDS) {
  test(`${id}: fetched with a source, or snippet-only with the blocking error in notes`, () => {
    const e = ENTRIES.find((x) => x.id === id);
    assert.ok(e, "entry exists");
    if (e.verified === "fetched") {
      assert.ok(Array.isArray(e.sources_fetched) && e.sources_fetched.length > 0);
      assert.equal(e.verified_on, "2026-10-09");
    } else {
      assert.equal(e.verified, "snippet-only");
      assert.match(e.notes, /403|404|could not/i);
    }
  });
}

test("meta.json verified_on_official_site equals the number of fetched entries", () => {
  assert.equal(META.verified_on_official_site, ENTRIES.filter((e) => e.verified === "fetched").length);
  assert.equal(META.count, ENTRIES.length);
});

test("a card with no deadline date posted has no deadline_iso", () => {
  for (const id of IDS) {
    const e = ENTRIES.find((x) => x.id === id);
    if (e.deadline_confidence !== "confirmed-2026-27") assert.equal(e.deadline_iso, null);
  }
});
