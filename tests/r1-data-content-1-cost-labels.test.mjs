import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r1-data-content-1. The CMU card is a fee-based card, so its name must not say "paid".
// Four cards used paid_type "stipend" for expense money (materials, meals, transportation) or
// for a stipend with no pay amount stated. They now say "not-stated". Their pay_detail sentences stay.

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const byId = new Map(ENTRIES.map((card) => [card.id, card]));

test("CMU card name no longer says paid and keeps its fee-based type", () => {
  const card = byId.get("pittsburgh-cmu-pre-college-programs");
  assert.equal(card.name, "Pre-College Programs (cost to you)");
  assert.equal(card.paid_type, "fee-based");
  assert.ok(!/\bpaid\b/i.test(card.name));
});

test("the four expense-only cards are not-stated and keep their pay_detail sentence", () => {
  const expected = {
    "mca-denver-teen-artist-in-residence": /stipend for materials/,
    "minnesota-house-high-school-page-program": /Small meal stipend/,
    "berkeley-rep-teen-council": /Transportation stipend/,
    "seattle-childrens-research-training-program-high-school": /A stipend is paid to cover transportation and meals/,
  };
  for (const [id, sentence] of Object.entries(expected)) {
    const card = byId.get(id);
    assert.ok(card, `${id} missing from entries.json`);
    assert.equal(card.paid_type, "not-stated", id);
    assert.match(card.pay_detail, sentence, id);
    assert.ok(!/[\u2013\u2014]/.test(card.pay_detail), `${id} pay_detail has a dash`);
  }
});
