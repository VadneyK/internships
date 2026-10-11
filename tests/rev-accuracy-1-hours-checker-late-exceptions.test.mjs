// The hours checker must not call a legal late shift "not allowed" and must say when a limit is unconfirmed (ticket r1-accuracy-1).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const PM = JSON.parse(readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const week = (o) => [0, 1, 2, 3, 4, 5, 6].map((i) => o[i] || null);

test("CA 16 plan ending 12:30 a.m. names the exception and does not say not allowed", () => {
  const r = L.hoursCheck(PM.states.ca.limits, 16, false, week({ 5: { from: 18, to: 24.5 } }));
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /12:30 a\.m\./);
  assert.match(r.problems[0], /usual limit of 10 p\.m\./);
  assert.doesNotMatch(r.problems[0], /is not allowed/);
});

test("NJ 16 over 40 hours in school says the limit is unconfirmed", () => {
  const r = L.hoursCheck(PM.states.nj.limits, 16, true, week({ 0: { from: 8, to: 16 }, 1: { from: 8, to: 16 }, 2: { from: 8, to: 16 }, 3: { from: 8, to: 16 }, 4: { from: 8, to: 16 }, 5: { from: 8, to: 16 } }));
  assert.ok(r.problems.some((x) => /could not confirm/.test(x)));
  assert.equal(r.unconfirmed, true);
});

test("a state with no lateNote still returns the numeric late limit", () => {
  const r = L.hoursCheck(PM.states.wa.limits, 16, true, week({ 0: { from: 17, to: 23 } }));
  assert.ok(r.problems.some((x) => /past the usual limit of 7 p\.m\.|past the usual limit of \d+ p\.m\./.test(x)));
  assert.ok(!r.problems.some((x) => /Later is allowed/.test(x)));
});
