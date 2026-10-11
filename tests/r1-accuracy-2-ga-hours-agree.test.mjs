// Georgia hours: the permit finder must carry the same Georgia-own rules the States page lists (ticket r1-accuracy-2).
// Run with: node --test tests/r1-accuracy-2-ga-hours-agree.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const GA14 = PM.states.ga.hours["14"];
const STATES_HTML = fs.readFileSync(new URL("../src/states.html", import.meta.url), "utf8");
const PHRASES = ["9 p.m. and 6 a.m.", "4 hours on a school day"];

test("GA hours 14 names Georgia's own under-16 limits", () => {
  for (const p of PHRASES) assert.ok(GA14.includes(p), `states.ga.hours.14 contains "${p}"`);
});

test("the same Georgia phrases are on the States page", () => {
  for (const p of PHRASES) assert.ok(STATES_HTML.includes(p), `src/states.html contains "${p}"`);
});
