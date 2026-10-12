import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Lifeguard course cards that teach a skill and lead to a job are typed apprenticeship-trades, the same
// type already used for the Charlottesville lifeguard training and the Red Cross lifeguard WSI card.
// paid-youth-program is kept for cards that pay a teen for work. The type must be allowed by the schema.

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));

const COURSE_CARDS = [
  "burnaby-lifeguard-swim-instructor-pathway",
  "lafayette-parks-lifeguard-certification-course",
  "north-vancouver-recreation-lifeguard-swim-instructor-pathway",
  "ann-arbor-parks-lifeguard-certification",
  "durham-parks-durham-aquatic-school-lifeguard",
];

const schema = readJson(path.join(root, "data", "schema", "program.schema.json"));
const allowedTypes = schema.properties.type.enum;

test("the course type is allowed by the schema", () => {
  assert.ok(allowedTypes.includes("apprenticeship-trades"));
});

for (const id of COURSE_CARDS) {
  test(`${id} is typed as a training course, not a paid youth program`, () => {
    const card = readJson(path.join(root, "data", "programs", `${id}.json`));
    assert.equal(card.id, id);
    assert.equal(card.type, "apprenticeship-trades");
    assert.notEqual(card.type, "paid-youth-program");
  });
}
