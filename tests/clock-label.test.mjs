// 2026-10-15: lib.js clockLabel. The hours checker used to print a limit of 24 (midnight; Pennsylvania at 16 and two
// summer rows in data/permits.json) as "12 p.m.", which is noon, and would print 21.5 as "9.5 p.m.".
// Run with: node --test tests/clock-label.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
globalThis.window = globalThis.window || {};
const L = require("../assets/js/lib.js");

test("clockLabel says hours the way people say them", () => {
  const cases = [[0, "midnight"], [24, "midnight"], [5, "5 a.m."], [7, "7 a.m."], [11.5, "11:30 a.m."], [12, "noon"], [12.25, "12:15 p.m."],
    [13, "1 p.m."], [19, "7 p.m."], [21.5, "9:30 p.m."], [22, "10 p.m."], [23.75, "11:45 p.m."], [24.5, "12:30 a.m."], [0.05, "12:03 a.m."], [23.999, "midnight"], ["7", "7 a.m."]];
  for (const [h, want] of cases) assert.equal(L.clockLabel(h), want, String(h));
});

test("hoursCheck names midnight, not noon, for a limit of 24", () => {
  const r = L.hoursCheck({ "16": { latest: 24 } }, 16, true, [{ from: 18, to: 24.5 }]);
  assert.deepEqual(r.problems, ["Monday: the end time is past the usual limit of midnight at 16."]);
});

test("hoursCheck keeps the familiar wording for whole hours and gives half hours as h:30", () => {
  assert.equal(L.hoursCheck({ "14": { latest: 19, earliest: 7 } }, 14, true, [{ from: 6, to: 20 }]).problems.join(" "),
    "Monday: starting before 7 a.m. is not allowed at 14. Monday: the end time is past the usual limit of 7 p.m. at 14.");
  assert.equal(L.hoursCheck({ "16": { latest: 21.5 } }, 16, false, [{ from: 18, to: 22 }]).problems[0],
    "Monday: the end time is past the usual limit of 9:30 p.m. at 16.");
});

test("every latest, latestSummer and earliest in data/permits.json gets a label with no decimal point", () => {
  const p = require("../data/permits.json");
  const seen = new Set();
  (function walk(v) {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if (/^(latest|latestSummer|earliest|lateMax)$/.test(k) && typeof x === "number") seen.add(x);
      walk(x);
    }
  })(p);
  assert.ok(seen.size >= 4);
  for (const h of seen) assert.match(L.clockLabel(h), /^(midnight|noon|\d{1,2}(:\d{2})? [ap]\.m\.)$/, String(h));
});
