// NYC Student OMNY card: the cost line must not state as fact what the work line says the pages disagree on,
// and the who line must say who qualifies, not only who is excluded (ticket r1-accuracy-4).
// Run with: node --test tests/r1-accuracy-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const TR = JSON.parse(fs.readFileSync(new URL("../data/transit.json", import.meta.url), "utf8"));
const nyc = TR.places.find((p) => p.id === "nyc");

test("NYC cost line attributes the any-time and weekend and summer claims to the OMNY page", () => {
  assert.ok(nyc.cost.includes("The OMNY page says it works any time, on weekends and in summer."), nyc.cost);
  assert.ok(!/any time, with transfers/.test(nyc.cost), "any time must not be stated as fact");
  assert.ok(!/on weekends and in summer\./.test(nyc.cost.replace("The OMNY page says it works any time, on weekends and in summer.", "")));
});

test("NYC cost line and work line do not contradict each other", () => {
  assert.match(nyc.work, /school activities/);
  assert.doesNotMatch(nyc.cost, /^Free Student OMNY card: 4 free rides a day, any time/);
});

test("NYC who line states the 0.5 mile rule for grades 7 to 12 in both directions", () => {
  assert.ok(nyc.who.includes("Grades 7 to 12 who live less than 0.5 mile from school are not eligible."), nyc.who);
  assert.ok(nyc.who.includes("Grades 7 to 12 who live 0.5 mile or more from school get an OMNY card."), nyc.who);
});

test("NYC who line names only exceptions the eligibility page lists", () => {
  assert.match(nyc.who, /temporary housing or foster care/);
  assert.doesNotMatch(nyc.who, /medical|safety/);
});
