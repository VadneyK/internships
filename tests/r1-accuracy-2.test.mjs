// Wisconsin permit headline must not state ages the job caveat says the DWD pages dispute (ticket r1-accuracy-2).
// Run with: node --test tests/r1-accuracy-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const WI = PM.states.wi;

test("WI permit headline says ages vary, not a flat 14 and 15", () => {
  assert.equal(WI.permit, "Work permit (ages vary, confirm with DWD)");
  assert.doesNotMatch(WI.permit, /^Work permit for 14 and 15 year olds$/);
});

test("WI steps cite both DWD pages for the age disagreement", () => {
  const step = WI.steps.find((s) => /ages vary/i.test(s));
  assert.ok(step, "WI steps has an age-variation step");
  assert.ok(step.includes("https://dwd.wisconsin.gov/er/laborstandards/workpermit/minoremployment.htm"));
  assert.ok(step.includes("https://dwd.wisconsin.gov/er/laborstandards/workpermit/"));
});

test("parents.json WI permit label matches permits.json", () => {
  const PR = JSON.parse(fs.readFileSync(new URL("../data/parents.json", import.meta.url), "utf8"));
  const rows = JSON.stringify(PR);
  const wiRow = rows.match(/\{[^{}]*"id":"wi"[^{}]*\}/);
  assert.ok(wiRow, "parents.json has a wi row");
  assert.ok(wiRow[0].includes(`"permit":"${WI.permit}"`), "parents.json WI permit equals permits.json");
});
