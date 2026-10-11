// Ages 12 to 14 page: every fixed dollar amount in the Red Cross and Scouts cards carries the
// date of the page we read (ticket r1-accuracy-4, price dates). Dollar figures must not change.
// Run with: node --test tests/rev-accuracy-4-younger-price-dates.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const Y = JSON.parse(fs.readFileSync(new URL("../data/younger.json", import.meta.url), "utf8"));
const DATE = "Oct 9, 2026";

const priced = [
  ["Red Cross Babysitting Basics", Y.train.find((t) => t.t === "Red Cross Babysitting Basics (online)")],
  ["Red Cross first aid and CPR", Y.train.find((t) => t.t === "Red Cross first aid and CPR")],
  ["Scouts BSA", Y.groups.find((g) => g.n === "Scouts BSA")],
  ["Girl Scouts", Y.groups.find((g) => g.n === "Girl Scouts")],
];

test("the four priced cards are all found", () => {
  for (const [name, entry] of priced) assert.ok(entry, name + " is missing from younger.json");
});

for (const [name, entry] of priced) {
  test(name + " card states a dollar amount and the Oct 9, 2026 price date", () => {
    assert.match(entry.d, /\$\d/, name + ": no dollar amount");
    assert.ok(entry.d.includes(DATE), name + ": missing '" + DATE + "'");
    assert.ok(entry.d.includes("Price on the page we read " + DATE + "."), name + ": date sentence not found");
  });
}

test("younger.json read stamp is still Oct 9, 2026", () => {
  assert.equal(Y.read, DATE);
});

test("the new price sentence uses no dash characters", () => {
  for (const [name, entry] of priced) {
    assert.doesNotMatch(entry.d, /[\u2012\u2013\u2014]/, name + ": dash character found");
  }
});
