import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const load = (id) => JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));

const CASES = [
  ["civil-air-patrol-california-wing-cadets", ["statewide", "los-angeles", "san-diego"]],
  ["ca-boys-girls-state", ["statewide", "sacramento"]],
  ["mtc-high-school-internship-program", ["east-bay", "oakland", "san-francisco", "peninsula", "silicon-valley", "virtual"]],
  ["michigan-ala-girls-state", ["michigan", "lansing"]],
];

for (const [id, regions] of CASES) {
  test(`${id} carries the region tags its city text names`, () => {
    const card = load(id);
    for (const r of regions) {
      assert.ok(card.regions.includes(r), `${id} must include region ${r}`);
    }
    assert.equal(new Set(card.regions).size, card.regions.length, "regions must be unique");
  });
}

// Ticket r1-data-content-2: these cards say pay is not stated, so they are not-stated, not unpaid.
const PAY_NOT_STATED_CARDS = [
  "breakthrough-sacramento-teaching-intern",
  "facciotti-lab-hs-internships",
  "youth-radio-oakland",
  "nyc-votes-youth-ambassadors",
  "san-diego-la-jolla-playhouse-teen-council",
  "twin-cities-walker-art-center-teen-arts-council",
  "twin-cities-minneapolis-parks-youth-advisory-council",
  "illinois-isbe-student-advisory-council",
];

for (const id of PAY_NOT_STATED_CARDS) {
  test(`${id} is not-stated, not unpaid, because its pay_detail says pay is not stated`, () => {
    const card = load(id);
    assert.equal(card.paid_type, "not-stated");
    assert.match(card.pay_detail, /not stated/i);
  });
}
