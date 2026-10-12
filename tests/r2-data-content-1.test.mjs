import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-data-content-1. Five cards had a paid_type that did not match their own text.
// Madison Gateway to College is fee-based (students pay fees; it is not a job).
// NHMU Teen Explainers, Portland Parks lifeguard training and Durham Aquatic School are mixed
// (a wage or a volunteer choice, or free training followed by paid jobs, with rates not all stated).
// Seattle Children's research program is left as not-stated here; see the r1-data-content-1 test.

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const byId = new Map(ENTRIES.map((card) => [card.id, card]));

test("the four mismatched cards now have the paid_type their text describes", () => {
  const expected = {
    "madison-college-gateway-to-college": "fee-based",
    "nhmu-teen-explainers": "mixed",
    "portland-parks-lifeguard-swim-instructor-training": "mixed",
    "durham-parks-durham-aquatic-school-lifeguard": "mixed",
  };
  for (const [id, type] of Object.entries(expected)) {
    const card = byId.get(id);
    assert.ok(card, `${id} missing from entries.json`);
    assert.equal(card.paid_type, type, id);
  }
});

test("fee-based Gateway card still names the cost in pay_detail", () => {
  const card = byId.get("madison-college-gateway-to-college");
  assert.match(card.pay_detail, /students pay student fees/i);
});

test("the cards are mirrored in the lite and core files with the same paid_type", () => {
  const lite = JSON.parse(fs.readFileSync(new URL("../data/entries-lite.json", import.meta.url), "utf8"));
  const liteById = new Map(lite.map((card) => [card.id, card]));
  for (const id of ["madison-college-gateway-to-college", "nhmu-teen-explainers",
    "portland-parks-lifeguard-swim-instructor-training", "durham-parks-durham-aquatic-school-lifeguard"]) {
    assert.equal(liteById.get(id).paid_type, byId.get(id).paid_type, id);
  }
});
