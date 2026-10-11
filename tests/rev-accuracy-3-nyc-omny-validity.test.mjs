// NYC Student OMNY card validity must say the card works all year, including summer,
// and the work line must still tell a teen to ask the school before counting on it for a job.
// Run with: node --test tests/rev-accuracy-3-nyc-omny-validity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const TRANSIT = JSON.parse(fs.readFileSync(new URL("../data/transit.json", import.meta.url), "utf8"));
const nyc = TRANSIT.places.find((p) => p.id === "nyc");

test("NYC ends line no longer says no end date is stated", () => {
  assert.ok(nyc, "nyc place exists");
  assert.notEqual(nyc.ends, "No end date stated.");
});

test("NYC ends line mentions summer and the school page", () => {
  assert.match(nyc.ends, /summer/);
  assert.match(nyc.ends, /school page/);
});

test("NYC work line still says to ask the school before counting on it for a job", () => {
  assert.match(nyc.work, /Ask your school before you count on it for a job\./);
});

test("NYC work line keeps the school-trips-only caveat", () => {
  assert.match(nyc.work, /getting to school and school activities/);
});

test("NYC cost keeps the 4 rides a day and $3 figures", () => {
  assert.match(nyc.cost, /4 free rides a day/);
  assert.match(nyc.cost, /\$3/);
});
