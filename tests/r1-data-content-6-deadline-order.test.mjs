// Ticket r1-data-content-6 (rewrite): a rolling or year-round card leads its deadline_text
// with the rule that applies today. A past date stays in the text as a clearly past sentence.
// The existing tests/r1-data-content-6.test.mjs belongs to another ticket, so this file is separate.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const ENTRIES = read("../data/entries.json");
const DETAIL_IDS = [
  ["oakland-zoo-teen-wild-guides", /^Accepted year-round\. .*The Sept 1, 2026 fall application date has passed\./],
  ["phoenix-mim-student-volunteer-program", /^No other deadline stated\. The fall 2026 Museum Guide deadline of Sept 25, 2026 has passed\.$/],
  ["ohio-ffa-state-association", /^Next date: Nov 30, 2026, for all chapters\. The September 30, 2026 date for students in Fall CDEs has passed\./],
  ["fox-valley-park-district-teen-volunteers", /^No deadline\. The Fall Day of Service on October 3, 2026 has passed\./],
  ["philadelphia-fleisher-teen-lounge", /^Drop in during the school year, for Teen Lounge 2026-2027\. Fall workshops started Tuesday, Sept 8, 2026, and that date has passed\.$/],
  ["palatine-library-teen-volunteers-and-tab", /^Book review hours count for reviews submitted September 1, 2026 to May 15, 2027\. Teen Advisory Board applications run August 1 to 31, and that window has passed\.$/],
];

for (const [id, pattern] of DETAIL_IDS) {
  test(`${id}: deadline_text leads with today's rule and keeps the past date as a past sentence`, () => {
    const card = read(`../data/programs/${id}.json`);
    assert.match(card.deadline_text, pattern);
    assert.doesNotMatch(card.deadline_text, /[\u2013\u2014]/);
  });

  test(`${id}: generated entry carries the same deadline_text`, () => {
    const card = read(`../data/programs/${id}.json`);
    const entry = ENTRIES.find((e) => e.id === id);
    assert.ok(entry, "entry exists");
    assert.equal(entry.deadline_text, card.deadline_text);
  });
}
