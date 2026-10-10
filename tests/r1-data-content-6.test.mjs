import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r1-data-content-6.
// VA Loma Linda: the card's own who_can_apply says ages 14 to 18, so min_age and max_age
// must match it. Without them the age filter hides the program from every teen.
// MLH: the pay_detail says the Fellowship pays a stipend, so paid_type is mixed, not unpaid.

const VA_ID = "va-loma-linda-summer-youth-volunteer-program";
const MLH_ID = "major-league-hacking";
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const va = read(`../data/programs/${VA_ID}.json`);
const mlh = read(`../data/programs/${MLH_ID}.json`);
const ENTRIES = read("../data/entries.json");

test(`${VA_ID}: min_age and max_age match the 14 to 18 rule in who_can_apply`, () => {
  assert.equal(va.min_age, 14);
  assert.equal(va.max_age, 18);
  assert.match(va.who_can_apply, /ages 14 to 18/);
});

test(`${VA_ID}: the 2024 flyer warning is kept`, () => {
  assert.match(va.who_can_apply, /Based on the 2024 flyer; check the current year's rules\./);
});

test(`${MLH_ID}: paid_type is mixed and pay_detail still names the stipend`, () => {
  assert.equal(mlh.paid_type, "mixed");
  assert.match(mlh.pay_detail, /The Fellowship pays a stipend/);
});

test(`${VA_ID}: generated entry carries the ages`, () => {
  const entry = ENTRIES.find((e) => e.id === VA_ID);
  assert.ok(entry, "entry exists");
  assert.equal(entry.min_age, 14);
  assert.equal(entry.max_age, 18);
});

test(`${MLH_ID}: generated entry carries mixed pay`, () => {
  const entry = ENTRIES.find((e) => e.id === MLH_ID);
  assert.ok(entry, "entry exists");
  assert.equal(entry.paid_type, "mixed");
});

test("the two changed program files contain no em dash or en dash", () => {
  for (const card of [va, mlh]) {
    assert.doesNotMatch(JSON.stringify(card), /[\u2013\u2014]/);
  }
});
