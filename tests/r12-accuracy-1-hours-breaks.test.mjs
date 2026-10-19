// Quality sweep 2026-10-16 (issue #9 sweep, docs/research/quality-sweep-2026-10.md item F1).
// The hours planner had one "School is out (summer, break)" choice, and it applied the summer latest hour (9 p.m. at 14 and 15)
// to every week off. The 9 p.m. rule runs June 1 to Labor Day only, so a 7 to 9 p.m. plan over winter break was told it fit.
// hoursCheck now takes notSummer: a break outside summer keeps the school-time latest hour, with the day off and week off caps.
// Run with: node --test tests/r12-accuracy-1-hours-breaks.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
globalThis.window = globalThis.window || {};
const L = require("../assets/js/lib.js");
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const ca = PM.states.ca.limits;
const week = (d) => [d, null, null, null, null, null, null];

test("winter or spring break: a 7 to 9 p.m. shift at 14 in California is past the 7 p.m. limit", () => {
  const r = L.hoursCheck(ca, 14, false, week({ from: 19, to: 21 }), true);
  assert.equal(r.limited, true);
  assert.deepEqual(r.problems, ["Monday: the end time is past the usual limit of 7 p.m. at 14."]);
});

test("summer break: the same shift fits, because 9 p.m. is allowed June 1 to Labor Day", () => {
  assert.deepEqual(L.hoursCheck(ca, 14, false, week({ from: 19, to: 21 })).problems, []);
  assert.deepEqual(L.hoursCheck(ca, 14, false, week({ from: 19, to: 21 }), false).problems, []);
});

test("another break still uses the day off and week off caps, not the school-day caps", () => {
  const eight = L.hoursCheck(ca, 15, false, week({ from: 9, to: 17 }), true);
  assert.deepEqual(eight.problems, [], "8 hours on a day off is allowed at 15");
  const nine = L.hoursCheck(ca, 15, false, week({ from: 9, to: 18 }), true);
  assert.ok(nine.problems.some((p) => /9 hours is more than the 8 hour limit on a day off from school/.test(p)), nine.problems.join(" | "));
  const days = [0, 1, 2, 3, 4, 5, 6].map(() => ({ from: 9, to: 15 }));
  const r = L.hoursCheck(ca, 14, false, days, true);
  assert.ok(r.problems.some((p) => /42 hours, more than the 40 hour limit when school is out/.test(p)), r.problems.join(" | "));
});

test("notSummer changes nothing while school is in session", () => {
  const a = L.hoursCheck(ca, 14, true, week({ from: 15, to: 18 }));
  const b = L.hoursCheck(ca, 14, true, week({ from: 15, to: 18 }), true);
  assert.deepEqual(a, b);
});

test("a state with no summer hour keeps its one latest hour on any break (16 in California)", () => {
  const r = L.hoursCheck(ca, 16, false, week({ from: 15, to: 23 }), true);
  assert.ok(r.problems.some((p) => /past the usual limit of 10 p\.m\. at 16/.test(p)), r.problems.join(" | "));
  assert.deepEqual(L.hoursCheck(ca, 16, false, week({ from: 15, to: 23 }), true), L.hoursCheck(ca, 16, false, week({ from: 15, to: 23 })));
});

test("every full state with a summer hour gives a break outside summer its school-time hour instead", () => {
  let checked = 0;
  for (const [id, s] of Object.entries(PM.states)) {
    const lim = s.limits && s.limits["14"];
    if (!lim || lim.latestSummer == null || lim.latest == null || lim.latestSummer <= lim.latest) continue;
    const end = Math.min(lim.latestSummer, 23.5);
    const from = Math.max(lim.earliest || 0, end - 1);
    const summer = L.hoursCheck(s.limits, 14, false, week({ from, to: end }));
    const brk = L.hoursCheck(s.limits, 14, false, week({ from, to: end }), true);
    assert.ok(!summer.problems.some((p) => /end time/.test(p)), id + " summer end at the summer hour is fine");
    assert.ok(brk.problems.some((p) => /end time is past the usual limit/.test(p)), id + " break end at the summer hour is flagged");
    checked++;
  }
  assert.ok(checked >= 5, "expected several states with a later summer hour, found " + checked);
});
