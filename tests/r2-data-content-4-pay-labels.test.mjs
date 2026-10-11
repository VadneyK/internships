// Ticket r2-data-content-4: the pay label on three cards must agree with pay_detail.
// Run with: node --test tests/r2-data-content-4-pay-labels.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = (id) => JSON.parse(readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
const ENTRIES = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

test("NC Catalyst is mixed (free program, paid internships optional), not plainly paid", () => {
  const c = load("ncsu-catalyst-stem-students-with-disabilities");
  assert.equal(c.paid_type, "mixed");
  assert.match(c.pay_detail, /free/i);
  assert.match(c.pay_detail, /paid STEM internships/i);
  assert.doesNotMatch(c.pay_detail, /\$\d/);
});

test("Artists For Humanity stays paid and says the first 36 hours are unpaid", () => {
  const c = load("boston-artists-for-humanity-teen-jobs");
  assert.equal(c.paid_type, "paid");
  assert.match(c.pay_detail, /^Paid after training/);
  assert.match(c.pay_detail, /first 36 Foundation Studio hours are unpaid/);
});

test("Seattle WAGES stays paid, keeps its rate and hours, and says the first week is unpaid", () => {
  const c = load("seattle-ymca-wages-ten-week-internship");
  assert.equal(c.paid_type, "paid");
  assert.match(c.pay_detail, /^\$20\.97 an hour for up to 135 hours over 9 weeks\./);
  assert.match(c.pay_detail, /The first week is unpaid\./);
});

test("the generated entries carry the same paid_type and pay_detail", () => {
  for (const id of ["ncsu-catalyst-stem-students-with-disabilities", "boston-artists-for-humanity-teen-jobs", "seattle-ymca-wages-ten-week-internship"]) {
    const card = load(id);
    const entry = ENTRIES.find((e) => e.id === id);
    assert.ok(entry, id);
    assert.equal(entry.paid_type, card.paid_type, id);
    assert.equal(entry.pay_detail, card.pay_detail, id);
  }
});
