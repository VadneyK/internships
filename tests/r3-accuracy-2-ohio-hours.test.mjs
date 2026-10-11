// Ohio hours card for 14 and 15 year olds: the 2016 poster is flagged as older than the law,
// and the night-before-a-non-school-day rule is its own sentence (ticket r3-accuracy-2).
// Run with: node --test tests/r3-accuracy-2-ohio-hours.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const oh = PM.states.oh;

test("Ohio hours.14 ends with the poster warning", () => {
  assert.match(
    oh.hours["14"],
    /The state poster linked on this card is from 2016, before this law, so its hours may be different\. Use the law link and confirm with the Ohio Department of Commerce\.$/
  );
});

test("Ohio hours.14 states the night-before rule as its own sentence, not inside the after 7 p.m. clause", () => {
  assert.ok(oh.hours["14"].includes("The night before a non-school day, 7 to 9 p.m. is allowed with parent approval."));
  assert.doesNotMatch(oh.hours["14"], /after 7 p\.m\. at other times \(/);
});

test("Ohio poster link title says it is older than the new law", () => {
  const poster = oh.links.find((l) => l.u.includes("laws_MLLPoster"));
  assert.ok(poster, "poster link exists");
  assert.equal(poster.t, "Ohio minor labor law poster (2016, older than the new law)");
});
