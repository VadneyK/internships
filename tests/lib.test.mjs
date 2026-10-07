// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const NOW = new Date(2026, 9, 7).getTime(); // Oct 7, 2026
const base = {
  id: "x", name: "Example Program", org: "Org", regions: ["oakland"], city: "Oakland, CA", type: "paid-youth-program",
  fields: ["health"], what_you_do: "Do things.", min_age: 16, max_age: 19, grades: null, paid_type: "paid", season: "summer",
  status: "open-now", deadline_iso: "2027-01-08", verified: "fetched", priority: 1, needs_work_permit: true
};

test("effStatus: a passed deadline turns Open now into Closed", () => {
  assert.equal(L.effStatus({ ...base, deadline_iso: "2026-10-01" }, NOW), "closed-expect-reopen");
  assert.equal(L.effStatus(base, NOW), "open-now");
});
test("effStatus: opens-soon flips to open-now on the opening date", () => {
  const e = { ...base, status: "opens-soon", opens_iso: "2026-11-16" };
  assert.equal(L.effStatus(e, NOW), "opens-soon");
  assert.equal(L.effStatus(e, new Date(2026, 10, 16).getTime()), "open-now");
  assert.equal(L.effStatus(e, new Date(2027, 0, 9).getTime()), "closed-expect-reopen");
});
test("rolling programs never expire", () => {
  assert.equal(L.effStatus({ ...base, status: "rolling", deadline_iso: null }, NOW), "rolling");
});
test("hubsOf groups regions", () => {
  assert.deepEqual(L.hubsOf({ regions: ["berkeley"] }), ["oak"]);
  assert.deepEqual(L.hubsOf({ regions: ["san-jose", "statewide"] }).sort(), ["state", "sv"]);
});
test("age filter respects min and max", () => {
  assert.equal(L.ageOk(base, 15), false);
  assert.equal(L.ageOk(base, 16), true);
  assert.equal(L.ageOk(base, 20), false);
  assert.equal(L.ageOk({ ...base, min_age: null, max_age: null }, 13), true);
});
test("matches: text search needs every word", () => {
  assert.equal(L.matches(base, { q: "health oakland" }, NOW), true);
  assert.equal(L.matches(base, { q: "health sacramento" }, NOW), false);
});
test("matches: pay groups", () => {
  assert.equal(L.matches(base, { paid: ["pay"] }, NOW), true);
  assert.equal(L.matches(base, { paid: ["free"] }, NOW), false);
  assert.equal(L.matches({ ...base, paid_type: "fee-based" }, { paid: ["fee"] }, NOW), true);
});
test("matches: verified-only and no-permit toggles", () => {
  assert.equal(L.matches({ ...base, verified: "snippet-only" }, { verified: true }, NOW), false);
  assert.equal(L.matches(base, { noPermit: true }, NOW), false);
});
test("matches: timing filters", () => {
  assert.equal(L.matches(base, { when: "open" }, NOW), true);
  assert.equal(L.matches({ ...base, deadline_iso: "2026-11-01" }, { when: "60" }, NOW), true);
  assert.equal(L.matches(base, { when: "60" }, NOW), false);
  assert.equal(L.matches({ ...base, status: "rolling" }, { when: "anytime" }, NOW), true);
});
test("sortList best: soonest open deadline first, closed last", () => {
  const a = { ...base, id: "a", name: "A", deadline_iso: "2027-02-01" };
  const b = { ...base, id: "b", name: "B", deadline_iso: "2026-11-01" };
  const c = { ...base, id: "c", name: "C", status: "closed-expect-reopen", deadline_iso: null };
  const d = { ...base, id: "d", name: "D", status: "rolling", deadline_iso: null };
  assert.deepEqual(L.sortList([c, a, d, b], "best", NOW).map((e) => e.id), ["b", "a", "d", "c"]);
});
test("esc escapes html and safeUrl blocks non-http", () => {
  assert.equal(L.esc('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  assert.equal(L.safeUrl("javascript:alert(1)"), "");
  assert.equal(L.safeUrl("https://example.org"), "https://example.org");
});
test("ageText", () => {
  assert.equal(L.ageText({ min_age: 16, max_age: 19 }), "Ages 16 to 19");
  assert.equal(L.ageText({ min_age: 14, max_age: null }), "Ages 14+");
  assert.equal(L.ageText({ min_age: null, max_age: null, grades: null }), "All high school ages");
});
