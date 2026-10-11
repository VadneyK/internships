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
