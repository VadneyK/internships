import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r1-data-content-6 (pay wording). The file tests/r1-data-content-6.test.mjs already
// belongs to another change in this round, so this ticket's checks live here.
// Aurora: unpaid, and the microgrant is money for the project, not pay to the teen.
// Mattel: unpaid, and the first sentence states the plain cost to the teen.
// BWSI: fee-based, and the first sentence states the family cost, not "Free".

const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const AURORA = read("../data/programs/aurora-youth-climate-action-fund.json");
const MATTEL = read("../data/programs/mattel-childrens-hospital-youth-ambassadors.json");
const BWSI = read("../data/programs/boston-mit-beaver-works-summer-institute.json");
const ENTRIES = read("../data/entries.json");

const firstSentence = (text) => text.split(/(?<=\.)\s/)[0];

test("aurora stays unpaid and says the microgrant is not pay to the teen", () => {
  assert.equal(AURORA.paid_type, "unpaid");
  assert.match(firstSentence(AURORA.pay_detail), /^You do not get paid\./);
  assert.match(AURORA.pay_detail, /The money pays for the project, not a wage to you\./);
});

test("mattel stays unpaid and its first sentence states the plain cost", () => {
  assert.equal(MATTEL.paid_type, "unpaid");
  assert.equal(firstSentence(MATTEL.pay_detail), "You pay nothing, but you must raise $1,250 for the hospital to earn an awards package.");
});

test("bwsi stays fee-based and leads with the family cost, not Free", () => {
  assert.equal(BWSI.paid_type, "fee-based");
  assert.equal(firstSentence(BWSI.pay_detail), "Families with income and assets under $200,000 pay nothing.");
  assert.doesNotMatch(BWSI.pay_detail, /^Free/);
  assert.match(BWSI.pay_detail, /Families above that pay \$3,000/);
});

test("generated entries carry the new pay_detail text", () => {
  for (const card of [AURORA, MATTEL, BWSI]) {
    const entry = ENTRIES.find((e) => e.id === card.id);
    assert.ok(entry, card.id + " entry exists");
    assert.equal(entry.pay_detail, card.pay_detail);
    assert.equal(entry.paid_type, card.paid_type);
  }
});

test("the three changed program files contain no em dash or en dash", () => {
  for (const card of [AURORA, MATTEL, BWSI]) {
    assert.doesNotMatch(JSON.stringify(card), /[\u2013\u2014]/);
  }
});
