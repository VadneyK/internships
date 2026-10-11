import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "programs", id + ".json"), "utf8"));

// min_age and max_age match the youngest and oldest age the card says can take part.
const CASES = [
  ["lansing-capital-area-humane-society-volunteer", 8, null],
  ["columbus-metro-parks-volunteer", 11, null],
  ["vancouver-stanley-park-ecology-youth-volunteer", 12, 17],
  ["wilmette-library-teen-volunteers", 11, null],
  ["pretend-city-volunteer-and-teen-programs", 12, 19],
  ["wisconsin-wing-civil-air-patrol-cadets", 12, 18],
  ["sf-sfzoo-teen-volunteers", 12, 17],
  ["san-jose-youth-commission", 13, 20],
];

for (const [id, min, max] of CASES) {
  test(`${id}: ages match the card`, () => {
    const d = load(id);
    assert.equal(d.min_age, min);
    assert.equal(d.max_age, max);
    const raw = fs.readFileSync(path.join(ROOT, "data", "programs", id + ".json"), "utf8");
    assert.ok(!/[\u2013\u2014]/.test(raw));
  });
}

test("wisconsin-wing names both sources and the stricter national band", () => {
  const t = load("wisconsin-wing-civil-air-patrol-cadets").who_can_apply;
  assert.ok(t.includes("12 to 19") && t.includes("12 and 18"));
});
