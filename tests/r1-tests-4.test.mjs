// Edge cases for ageOk, matches, rank, compare and sortList.
// Run with: node --test tests/r1-tests-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const NOW = new Date(2026, 9, 7).getTime(); // Oct 7, 2026, fixed so results never drift

const base = {
  org: "Example Org", regions: ["boston"], city: "Boston, MA", type: "internship", fields: ["health"],
  what_you_do: "Help out.", notes: "", who_can_apply: "Students.", min_age: null, max_age: null,
  paid_type: "paid", season: "summer", status: "rolling", deadline_iso: null, verified: "fetched", priority: 3
};
const mk = (o) => ({ ...base, ...o });

const FIX = [
  mk({ id: "open-soon", name: "Harbor Lab", status: "open-now", deadline_iso: "2026-10-20", min_age: 16, max_age: 18 }),
  mk({ id: "open-later", name: "River Crew", status: "open-now", deadline_iso: "2026-12-01", min_age: 14, max_age: 17 }),
  mk({ id: "open-nodate", name: "Garden Team", status: "open-now", min_age: 15, max_age: 18 }),
  mk({ id: "rolling-a", name: "Library Helpers", status: "rolling", min_age: 13, max_age: 16 }),
  mk({ id: "rolling-b", name: "Library Helpers", status: "rolling", min_age: 13, max_age: 16 }),
  mk({ id: "year-round", name: "Animal Shelter", status: "year-round", type: "volunteer", paid_type: "unpaid" }),
  mk({ id: "stale", name: "Old Deadline", status: "open-now", deadline_iso: "2026-09-01" }),
  mk({ id: "closed", name: "Closed Camp", status: "closed-expect-reopen", verified: "unverified" }),
  mk({ id: "unknown", name: "Mystery Role", status: "unknown", verified: "unverified", priority: 1 }),
  mk({ id: "virtual", name: "Online Mentors", status: "rolling", regions: ["virtual"], type: "virtual" }),
  mk({ id: "national", name: "National Program", status: "rolling", regions: ["national"] }),
  mk({ id: "oakland", name: "Oakland Jobs", status: "rolling", regions: ["oakland"] }),
  mk({ id: "no-regions", name: "No Regions", status: "rolling", regions: undefined })
];
const ids = (list) => list.map((e) => e.id);

test("ageOk: both limits null is true for any age", () => {
  const e = mk({ min_age: null, max_age: null });
  for (const a of [1, 12, 16, 18, 99, "16"]) assert.equal(L.ageOk(e, a), true);
});
test("ageOk: undefined limits behave like null", () => {
  const e = { id: "u", name: "U" };
  assert.equal(L.ageOk(e, 16), true);
});
test("ageOk: age as a string is read as a number", () => {
  const e = mk({ min_age: 14, max_age: 16 });
  assert.equal(L.ageOk(e, "16"), true);
  assert.equal(L.ageOk(e, "13"), false);
  assert.equal(L.ageOk(e, "17"), false);
});
test("ageOk: age 0, empty string, null and undefined mean no filter", () => {
  const e = mk({ min_age: 16, max_age: 18 });
  for (const a of [0, "", null, undefined]) assert.equal(L.ageOk(e, a), true);
});
test("ageOk: ages equal to min_age and max_age are allowed", () => {
  const e = mk({ min_age: 14, max_age: 16 });
  assert.equal(L.ageOk(e, 14), true);
  assert.equal(L.ageOk(e, 16), true);
  assert.equal(L.ageOk(e, 13), false);
});
test("ageOk: age 17 does not fit max_age 16", () => {
  assert.equal(L.ageOk(mk({ min_age: 14, max_age: 16 }), 17), false);
  assert.equal(L.ageOk(mk({ max_age: 16 }), 17), false);
});
test("ageOk: only one limit set", () => {
  assert.equal(L.ageOk(mk({ min_age: 16 }), 15), false);
  assert.equal(L.ageOk(mk({ min_age: 16 }), 40), true);
  assert.equal(L.ageOk(mk({ max_age: 16 }), 12), true);
});

test("matches: empty state returns true for every program", () => {
  for (const e of FIX) assert.equal(L.matches(e, {}, NOW), true, e.id);
});
test("matches: empty arrays and empty strings in state are no filter", () => {
  const s = { q: "", hubs: [], age: "", paid: [], types: [], fields: [], place: "", savedIds: [] };
  for (const e of FIX) assert.equal(L.matches(e, s, NOW), true, e.id);
});
test("matches: undefined regions does not throw", () => {
  const e = mk({ regions: undefined });
  assert.doesNotThrow(() => L.matches(e, {}, NOW));
  assert.doesNotThrow(() => L.matches(e, { hubs: ["oak"] }, NOW));
  assert.doesNotThrow(() => L.matches(e, { place: "city:boston" }, NOW));
  assert.doesNotThrow(() => L.matches(e, { q: "boston" }, NOW));
  assert.equal(L.matches(e, { hubs: ["oak"] }, NOW), false);
  assert.equal(L.matches(e, { place: "city:boston" }, NOW), false);
});
test("matches: null regions does not throw", () => {
  const e = mk({ regions: null });
  assert.doesNotThrow(() => L.matches(e, { place: "city:boston", placeOnline: true, hubs: ["oak"], q: "help" }, NOW));
});
test("matches: every word of a multi-word query must match", () => {
  const e = mk({ name: "Harbor Lab", what_you_do: "Test water samples." });
  assert.equal(L.matches(e, { q: "harbor water" }, NOW), true);
  assert.equal(L.matches(e, { q: "water harbor" }, NOW), true);
  assert.equal(L.matches(e, { q: "harbor volcano" }, NOW), false);
  assert.equal(L.matches(e, { q: "  harbor   water  " }, NOW), true);
});
test("matches: query words must start a word, so paid does not match unpaid", () => {
  const e = mk({ name: "Helpers", what_you_do: "An unpaid role." });
  assert.equal(L.matches(e, { q: "paid" }, NOW), false);
  assert.equal(L.matches(e, { q: "unpaid" }, NOW), true);
});
test("matches: query is not case sensitive", () => {
  assert.equal(L.matches(mk({ name: "Harbor Lab" }), { q: "HARBOR lab" }, NOW), true);
});
test("matches: saved true keeps only ids in savedIds", () => {
  const s = { saved: true, savedIds: ["rolling-a", "closed"] };
  assert.deepEqual(ids(FIX.filter((e) => L.matches(e, s, NOW))), ["rolling-a", "closed"]);
});
test("matches: saved true with no savedIds shows nothing", () => {
  assert.equal(FIX.filter((e) => L.matches(e, { saved: true }, NOW)).length, 0);
  assert.equal(FIX.filter((e) => L.matches(e, { saved: true, savedIds: [] }, NOW)).length, 0);
});
test("matches: savedIds without saved true does not filter", () => {
  assert.equal(FIX.filter((e) => L.matches(e, { savedIds: ["closed"] }, NOW)).length, FIX.length);
});
test("matches: place keeps local programs and hides far ones", () => {
  const s = { place: "city:boston" };
  const got = ids(FIX.filter((e) => L.matches(e, s, NOW)));
  assert.ok(got.includes("rolling-a"));
  assert.ok(!got.includes("oakland"));
  assert.ok(!got.includes("virtual"));
  assert.ok(!got.includes("national"));
});
test("matches: placeOnline adds virtual and national programs but not other places", () => {
  const s = { place: "city:boston", placeOnline: true };
  const got = ids(FIX.filter((e) => L.matches(e, s, NOW)));
  assert.ok(got.includes("virtual"));
  assert.ok(got.includes("national"));
  assert.ok(got.includes("rolling-a"));
  assert.ok(!got.includes("oakland"));
});
test("matches: an unknown place is ignored", () => {
  assert.equal(L.matches(mk({ regions: ["oakland"] }), { place: "city:nowhere" }, NOW), true);
});
test("matches: age filter hides programs the teen is too old or too young for", () => {
  const e = mk({ min_age: 14, max_age: 16 });
  assert.equal(L.matches(e, { age: 17 }, NOW), false);
  assert.equal(L.matches(e, { age: "16" }, NOW), true);
  assert.equal(L.matches(e, { age: 0 }, NOW), true);
  assert.equal(L.matches(e, { age: "" }, NOW), true);
});

test("rank: open with a deadline sorts before open without one, then anytime, closed, unknown", () => {
  const g = (id) => L.rank(FIX.find((e) => e.id === id), NOW)[0];
  assert.equal(g("open-soon"), 0);
  assert.equal(g("open-nodate"), 1);
  assert.equal(g("rolling-a"), 2);
  assert.equal(g("closed"), 3);
  assert.equal(g("stale"), 3);
  assert.equal(g("unknown"), 4);
});
test("rank: missing priority defaults to 3 and missing name does not throw", () => {
  const r = L.rank({ id: "z", status: "rolling" }, NOW);
  assert.equal(r[4], 3);
});
test("rank: always returns seven parts without a profile, with days only for group 0", () => {
  // group, deadline bucket, cost tier, days, priority, verified, name (an age fit key is added only with a profile age)
  for (const e of FIX) {
    const r = L.rank(e, NOW);
    assert.equal(r.length, 7);
    if (r[0] !== 0) assert.equal(r[3], 0);
  }
  assert.equal(L.rank(FIX[0], NOW)[3], 13);
});

test("compare: antisymmetric on every pair in the fixture", () => {
  for (const a of FIX) for (const b of FIX) {
    assert.equal(L.compare(a, b, NOW), -L.compare(b, a, NOW) || 0, a.id + " vs " + b.id);
  }
});
test("compare: an item equals itself and is transitive on the fixture", () => {
  for (const a of FIX) assert.equal(L.compare(a, a, NOW), 0);
  for (const a of FIX) for (const b of FIX) for (const c of FIX) {
    if (L.compare(a, b, NOW) <= 0 && L.compare(b, c, NOW) <= 0) assert.ok(L.compare(a, c, NOW) <= 0, [a.id, b.id, c.id].join());
  }
});

const MODES = [undefined, "rank", "name", "deadline"];
test("sortList: does not change the input array", () => {
  for (const mode of MODES) {
    const input = FIX.slice().reverse();
    const before = ids(input);
    const out = L.sortList(input, mode, NOW);
    assert.deepEqual(ids(input), before, "input changed for " + mode);
    assert.notEqual(out, input);
  }
});
test("sortList: every mode returns the same set of ids", () => {
  const want = ids(FIX).sort();
  for (const mode of MODES) {
    const got = ids(L.sortList(FIX, mode, NOW));
    assert.equal(got.length, FIX.length, String(mode));
    assert.deepEqual(got.slice().sort(), want, String(mode));
  }
});
test("sortList: handles an empty list in every mode", () => {
  for (const mode of MODES) assert.deepEqual(L.sortList([], mode, NOW), []);
});
test("sortList: default mode puts soonest deadline first and unknown last", () => {
  const out = ids(L.sortList(FIX, undefined, NOW));
  assert.equal(out[0], "open-soon");
  assert.ok(out.indexOf("open-soon") < out.indexOf("open-later"));
  assert.ok(out.indexOf("open-later") < out.indexOf("open-nodate"));
  assert.equal(out[out.length - 1], "unknown");
});
test("sortList: deadline mode puts future deadlines first, soonest first", () => {
  const out = ids(L.sortList(FIX, "deadline", NOW));
  assert.deepEqual(out.slice(0, 2), ["open-soon", "open-later"]);
  assert.ok(out.indexOf("stale") > 1);
});
test("sortList: name mode is alphabetical", () => {
  const names = L.sortList(FIX, "name", NOW).map((e) => e.name);
  for (let i = 1; i < names.length; i++) assert.ok(names[i - 1].localeCompare(names[i]) <= 0);
});
test("sortList: equal keys keep their input order in every mode", () => {
  const a = FIX.find((e) => e.id === "rolling-a"), b = FIX.find((e) => e.id === "rolling-b");
  assert.equal(L.compare(a, b, NOW), 0);
  for (const mode of MODES) {
    const fwd = ids(L.sortList([a, b], mode, NOW));
    const rev = ids(L.sortList([b, a], mode, NOW));
    assert.deepEqual(fwd, ["rolling-a", "rolling-b"], String(mode));
    assert.deepEqual(rev, ["rolling-b", "rolling-a"], String(mode));
  }
});
test("sortList: stable for equal deadlines in deadline mode", () => {
  const x = mk({ id: "x", name: "Same", status: "open-now", deadline_iso: "2026-11-01" });
  const y = mk({ id: "y", name: "Same", status: "open-now", deadline_iso: "2026-11-01" });
  assert.deepEqual(ids(L.sortList([x, y], "deadline", NOW)), ["x", "y"]);
  assert.deepEqual(ids(L.sortList([y, x], "deadline", NOW)), ["y", "x"]);
});
test("sortList: sorting twice gives the same order", () => {
  for (const mode of MODES) {
    const once = L.sortList(FIX, mode, NOW);
    assert.deepEqual(ids(L.sortList(once, mode, NOW)), ids(once), String(mode));
  }
});
