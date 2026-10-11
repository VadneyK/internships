// Direct tests for costTier (through rank), facetCounts, relaxOptions and topPicks on the real data.
// Run with: node --test tests/r2-tests-4-filter-helpers.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const entries = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const NOW = new Date(2026, 9, 10).getTime();

// costTier is private, it is the third key of rank(): 0 paid, 1 unpaid or not stated, 2 fee-based.
const tier = (e) => L.rank(e, NOW)[2];

test("costTier: only documented values for every card", () => {
  assert.ok(entries.length > 100);
  for (const e of entries) assert.ok([0, 1, 2].includes(tier(e)), e.id);
});
test("costTier: matches the documented groups", () => {
  for (const [t, want] of [["paid", 0], ["stipend", 0], ["mixed", 0], ["fee-based", 2], ["unpaid", 1], ["unpaid-credit", 1], ["not-stated", 1]])
    assert.equal(tier({ paid_type: t, name: "x" }), want, t);
});
test("costTier: missing or odd cost text is stable and lands on 1", () => {
  for (const t of [undefined, null, "", "PAID", "free?", 5, {}, "$$$"]) {
    const e = { paid_type: t, name: "x" };
    assert.equal(tier(e), 1);
    assert.equal(tier(e), tier(e));
  }
  assert.equal(tier({ name: "x" }), 1);
});

test("facetCounts: type counts add up to the list length, nothing negative", () => {
  const f = L.facetCounts(entries, {}, NOW);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(sum(f.types), entries.length);
  assert.equal(sum(f.paid), entries.length);
  for (const g of Object.values(f)) for (const n of Object.values(g)) assert.ok(n >= 0);
});
test("facetCounts: one filter on never raises a count above the unfiltered count", () => {
  const base = L.facetCounts(entries, {}, NOW);
  const states = [{ age: 15 }, { when: "open" }, { season: "summer" }, { verified: true }, { noPermit: true }, { paid: ["pay"] }, { types: ["paid-youth-program"] }, { fields: ["health"] }, { q: "art" }];
  for (const s of states) {
    const f = L.facetCounts(entries, s, NOW);
    for (const facet of Object.keys(base)) for (const k of Object.keys(base[facet])) {
      assert.ok(f[facet][k] >= 0);
      assert.ok(f[facet][k] <= base[facet][k], JSON.stringify(s) + " " + facet + " " + k);
    }
  }
});
test("facetCounts: empty and null inputs do not throw", () => {
  for (const [l, s] of [[[], {}], [null, null], [undefined, undefined], [[], null]]) {
    const f = L.facetCounts(l, s, NOW);
    for (const g of Object.values(f)) for (const n of Object.values(g)) assert.equal(n, 0);
  }
});

test("relaxOptions: a zero-result filter set lists an option that returns cards, and applying it never loses cards", () => {
  const states = [
    { q: "zzzqqq" }, { q: "zzzqqq", age: 15 }, { age: 3 }, { age: 99, paid: ["pay"] },
    { age: 12, noPermit: true, verified: true, when: "60", types: ["paid-youth-program"], fields: ["health"] },
    { place: "city:oakland", q: "zzzqqq" }, { hubs: ["oak"], age: 3 }
  ];
  let checked = 0;
  for (const s of states) {
    const before = entries.filter((e) => L.matches(e, s, NOW)).length;
    if (before !== 0) continue;
    checked++;
    const opts = L.relaxOptions(entries, s, NOW);
    assert.ok(opts.length >= 1 && opts.length <= 3, JSON.stringify(s));
    for (const o of opts) {
      assert.ok(o.count > 0);
      assert.ok(o.label && typeof o.key === "string");
      const next = Object.assign({}, s, { placeOnline: false });
      const v = s[o.key];
      next[o.key] = Array.isArray(v) ? [] : typeof v === "boolean" ? false : "";
      let n = entries.filter((e) => L.matches(e, next, NOW)).length;
      if (next.place && n < 3) { next.placeOnline = true; n = entries.filter((e) => L.matches(e, next, NOW)).length; }
      assert.equal(n, o.count);
      assert.ok(n >= before);
    }
  }
  assert.ok(checked >= 3);
});
test("relaxOptions: empty list, null and no filters return nothing without throwing", () => {
  assert.deepEqual(L.relaxOptions([], { q: "x" }, NOW), []);
  assert.deepEqual(L.relaxOptions(null, null, NOW), []);
  assert.deepEqual(L.relaxOptions(entries, {}, NOW), []);
});

test("topPicks: at most n, no duplicates, age fits, same input same output", () => {
  for (const age of [0, 12, 14, 16, 18]) for (const n of [0, 1, 3, 6]) {
    const p = { age: age || undefined };
    const a = L.topPicks(entries, p, NOW, n), b = L.topPicks(entries, p, NOW, n);
    assert.ok(a.length <= n);
    assert.equal(new Set(a.map((e) => e.id)).size, a.length);
    for (const e of a) assert.ok(L.ageOk(e, age), e.id);
    assert.deepEqual(a.map((e) => e.id), b.map((e) => e.id));
  }
  assert.ok(L.topPicks(entries, { age: 15 }, NOW, 3).length > 0);
});
test("topPicks: default is 3, negative n gives none, empty and null inputs return []", () => {
  assert.ok(L.topPicks(entries, {}, NOW).length <= 3);
  assert.deepEqual(L.topPicks(entries, {}, NOW, -2), []);
  assert.deepEqual(L.topPicks([], {}, NOW, 3), []);
  assert.deepEqual(L.topPicks(null, null, NOW, 3), []);
  assert.deepEqual(L.topPicks(undefined, undefined, NOW, 3), []);
});
