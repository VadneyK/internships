// BC age bands must not overlap or contradict. Run: node --test tests/r1-accuracy-4-bc-age-bands.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const bc = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8")).states.bc;

test("BC permit step says under 16 with separate 12-13 and 14-15 bands", () => {
  const s = bc.steps[2];
  assert.ok(/Under 16/.test(s) && /12 and 13/.test(s) && /14 and 15/.test(s) && /16 and older/.test(s), s);
  assert.ok(!/Ages 12 to 15 need a permit/.test(s));
});
test("BC hours: under 15 limits never claim to cover 15, and 15 gets standard rules", () => {
  assert.ok(bc.hours["12"].includes("Children under 15") && !/standard/.test(bc.hours["12"]));
  assert.ok(/At age 15 the standard/.test(bc.hours["14"]));
  assert.ok(/15 and older/.test(bc.hours["16"]));
  assert.ok(!/Employers of children 15 or older/.test(bc.hours["16"]));
});
test("BC supervision and adult lines do not invent an age band", () => {
  assert.ok(/no age bands/.test(bc.steps[1]));
  assert.ok(/no separate rule for workers under 19/.test(bc.adult));
  assert.ok(/16 and older/.test(bc.adult) && /no child employment permit/.test(bc.adult));
});
