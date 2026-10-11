import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "programs", id + ".json"), "utf8"));

// Each card's min_age matches the youngest age for its headline role, and a plain sentence
// explains any younger or stricter age that applies to another route.
const CASES = [
  { id: "chicago-youth-works-summer-jobs", min_age: 16, sentence: "The youngest age in the whole program is 14" },
  { id: "madison-henry-vilas-zoo-teen-volunteers", min_age: 14, sentence: "The youngest age for any role is 10" },
  { id: "columbus-metro-parks-volunteer", min_age: 11, sentence: "Ages 11 to 15 can help only at Inniswood Metro Gardens" },
  { id: "endeavor-health-edward-hospital-student-volunteer", min_age: 14, sentence: "most roles are for 16 and up", field: "notes" },
  { id: "endeavor-health-elmhurst-hospital-teen-volunteer", min_age: 14, sentence: "most roles are for 16 and up", field: "notes" },
  { id: "sacramento-food-bank-volunteer", min_age: 10, sentence: null },
  { id: "riverside-johnny-martin-sotelo-youth-opportunity-center", min_age: 14, sentence: "The youngest age at this site is 13" },
];

for (const c of CASES) {
  test(`${c.id}: min_age and age note`, () => {
    const d = load(c.id);
    assert.equal(d.min_age, c.min_age);
    if (c.sentence) {
      const text = c.field ? d[c.field] : d.who_can_apply;
      assert.ok(text.includes(c.sentence), `${c.id}: missing age sentence`);
    }
  });
}

test("age data in this batch has no em dash or en dash", () => {
  for (const c of CASES) {
    const raw = fs.readFileSync(path.join(ROOT, "data", "programs", c.id + ".json"), "utf8");
    assert.ok(!/[\u2013\u2014]/.test(raw), `${c.id} has a dash character`);
  }
});
