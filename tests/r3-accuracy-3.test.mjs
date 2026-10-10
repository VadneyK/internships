// Volunteer answers agree with what the same state's pages say (ticket r3-accuracy-3).
// Run with: node --test tests/r3-accuracy-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

test("New York volunteer under 14 says a parent or guardian must directly supervise, and is asked", () => {
  const r = L.permitFor(PM, "ny", 12, "volunteer");
  assert.equal(r.verdict, "ask");
  assert.match(r.text, /parent or guardian directly supervises/);
});

test("New York volunteer at 15 keeps the unchanged answer", () => {
  const r = L.permitFor(PM, "ny", 15, "volunteer");
  assert.equal(r.verdict, "ask");
  assert.match(r.text, /charitable, educational or religious organizations/);
  assert.doesNotMatch(r.text, /parent or guardian directly supervises/);
});

test("Michigan volunteer text says the youth employment law covers volunteers", () => {
  const r = L.permitFor(PM, "mi", 15, "volunteer");
  assert.match(r.text, /including volunteers/);
  assert.equal(PM.states.mi.kinds.volunteer.permit, null);
  assert.equal(r.verdict, "ask");
});

test("no state's volunteer text says 'do not say' when its job text mentions volunteers", () => {
  let checked = 0;
  for (const [st, s] of Object.entries(PM.states)) {
    const jobText = (s.kinds && s.kinds.job && s.kinds.job.text) || "";
    const volText = (s.kinds && s.kinds.volunteer && s.kinds.volunteer.text) || "";
    if (!/volunteer/i.test(jobText)) continue;
    checked++;
    assert.doesNotMatch(volText, /do not say/i, st + ": volunteer text contradicts job text");
  }
  assert.ok(checked >= 1, "at least one state's job text should mention volunteers");
});
