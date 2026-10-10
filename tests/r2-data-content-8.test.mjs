import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-data-content-8.
// Four school pathway cards are paid_type unpaid-credit with an empty pay_detail, so the Find card
// shows no "Pay or cost" line. Each now says "Not stated on the page." because the official page is silent on cost.
// Rule: every card whose paid_type is not plain "unpaid" must have a non-empty pay_detail.

const IDS = [
  "berkeley-high-cte",
  "cps-career-and-technical-education",
  "eden-area-rop",
  "scoe-cte",
];
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const ENTRIES = read("../data/entries.json");
const LITE = read("../data/entries-lite.json");

test("every card whose paid_type is not unpaid has a non-empty pay_detail string", () => {
  const bad = ENTRIES.filter(
    (e) => e.paid_type !== "unpaid" && !(typeof e.pay_detail === "string" && e.pay_detail.trim() !== ""),
  ).map((e) => e.id);
  assert.deepEqual(bad, []);
});

for (const id of IDS) {
  test(`${id}: pay_detail says Not stated on the page. in the program file and entries.json`, () => {
    const card = read(`../data/programs/${id}.json`);
    assert.equal(card.paid_type, "unpaid-credit");
    assert.equal(card.pay_detail, "Not stated on the page.");
    const entry = ENTRIES.find((e) => e.id === id);
    assert.ok(entry, "entry exists");
    assert.equal(entry.pay_detail, "Not stated on the page.");
  });

  test(`${id}: entries-lite.json carries the same pay_detail`, () => {
    const entry = LITE.find((e) => e.id === id);
    assert.ok(entry, "lite entry exists");
    assert.equal(entry.pay_detail, "Not stated on the page.");
  });
}

test("the four changed program files contain no em dash or en dash", () => {
  for (const id of IDS) {
    const raw = fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8");
    assert.doesNotMatch(raw, /[\u2013\u2014]/, id);
  }
});
