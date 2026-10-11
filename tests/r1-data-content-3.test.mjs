import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Two closed-expect-reopen cards kept deadline_iso 2026-10-09 after that date passed.
// Closed cards carry deadline_iso null and keep the date in deadline_text. No 2027 date is invented.

const IDS = ["nyc-dycd-work-learn-grow", "pittsburgh-warhol-youth-arts-council"];

for (const ID of IDS) {
  const card = JSON.parse(fs.readFileSync(new URL(`../data/programs/${ID}.json`, import.meta.url), "utf8"));

  test(`${ID}: closed card has no stale deadline_iso`, () => {
    assert.equal(card.status, "closed-expect-reopen");
    assert.equal(card.deadline_iso, null);
  });

  test(`${ID}: deadline_text still records the passed October 9, 2026 date`, () => {
    assert.match(card.deadline_text, /October 9, 2026/);
  });
}

// Ticket r1-data-content-3. Group B: cards whose pay_detail says pay is not stated, not mentioned
// or not listed must say not-stated, not unpaid (unpaid claims the page says there is no pay).
const PAY_UNKNOWN_IDS = [
  "la-metro-youth-council",
  "minnesota-youth-council",
  "nyc-bronx-community-college-upward-bound-math-science",
  "boston-mit-primes",
  "orange-county-choc-mi4-summer-internship",
  "atlanta-public-schools-mentorship-internship",
  "chattahoochee-riverkeeper-water-warriors",
  "clbl-farms-leadership",
];

for (const id of PAY_UNKNOWN_IDS) {
  test(`${id}: paid_type is not-stated, not unpaid`, () => {
    const card = JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
    assert.equal(card.paid_type, "not-stated");
  });
}

test("boston-mit-primes keeps the cost to join first in pay_detail", () => {
  const card = JSON.parse(fs.readFileSync(new URL("../data/programs/boston-mit-primes.json", import.meta.url), "utf8"));
  assert.ok(card.pay_detail.startsWith("Free to join."));
});
