// Paycheck notes must match what the estimate does (ticket r3-accuracy-2).
// Run with: node --test tests/r3-accuracy-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const M = JSON.parse(fs.readFileSync(new URL("../data/money.json", import.meta.url), "utf8"));
const NOTES = M.lineNotes;

test("pfl note says the estimate always subtracts it, not that it depends on the employer", () => {
  assert.doesNotMatch(NOTES.pfl, /Shown if your employer deducts it/);
  assert.match(NOTES.pfl, /subtracts it/);
  assert.match(NOTES.pfl, /We could not confirm that an employer takes it from a teen's first checks\./);
});

test("every preset with the pfl line has the pfl note that says it is subtracted", () => {
  const pflPresets = M.presets.filter((p) => p.extra.indexOf("pfl") > -1);
  assert.ok(pflPresets.length > 0, "at least one preset uses pfl");
  for (const p of pflPresets) {
    assert.ok(NOTES.pfl, p.id + " has a pfl note");
    assert.match(NOTES.pfl, /subtracts it/, p.id + " pfl note says it is subtracted");
  }
});

test("disability note says the $0.60 limit is per week and the estimate does not know the weeks covered", () => {
  assert.match(NOTES.dis, /up to \$0\.60 a week/);
  assert.match(NOTES.dis, /The \$0\.60 limit is per week\./);
  assert.match(NOTES.dis, /does not know how many weeks your check covers/);
});
