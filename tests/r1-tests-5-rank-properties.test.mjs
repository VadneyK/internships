// Ticket r1-tests-5: property tests for matches, rank and sortList on the real entries.json.
// 200 random filter states from a seeded PRNG. A failure prints the seed and the state.
// Run with: node --test tests/r1-tests-5-rank-properties.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

const NOW = new Date(2026, 9, 10).getTime();
const SEED = 20261010;
const STATES = 200;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
function pickSome(rnd, arr) {
  const out = arr.filter(() => rnd() < 0.4);
  return out.length ? out : [pick(rnd, arr)];
}
const WORDS = ["art", "science", "paid", "camp", "health", "coding", "teen", "museum", "library", "farm"];

// One generator per filter dimension, so a state is a set of independent filters.
const DIMS = {
  place: (r) => ({ place: pick(r, [...L.CITIES.map((c) => "city:" + c[0]), ...L.AREAS.map((a) => "area:" + a[0])]), placeOnline: r() < 0.5 }),
  hubs: (r) => ({ hubs: pickSome(r, L.HUBS.map((h) => h[0])) }),
  age: (r) => ({ age: 12 + Math.floor(r() * 7) }),
  when: (r) => ({ when: pick(r, ["open", "60", "anytime", "closed"]) }),
  season: (r) => ({ season: pick(r, ["summer", "fall", "winter", "spring"]) }),
  paid: (r) => ({ paid: pickSome(r, L.PAID_GROUPS.map((g) => g[0])) }),
  types: (r) => ({ types: pickSome(r, Object.keys(L.TYPES)) }),
  fields: (r) => ({ fields: pickSome(r, Object.keys(L.FIELDS).filter((k) => k !== "any")) }),
  verified: () => ({ verified: true }),
  noPermit: () => ({ noPermit: true }),
  saved: (r) => ({ saved: true, savedIds: ENTRIES.filter(() => r() < 0.05).map((e) => e.id) }),
  q: (r) => ({ q: pick(r, WORDS) })
};
const DIM_NAMES = Object.keys(DIMS);
const DIM_KEYS = { place: ["place", "placeOnline"], saved: ["saved", "savedIds"] };
const keysOf = (d) => DIM_KEYS[d] || [d];

function randomState(rnd) {
  const s = {};
  DIM_NAMES.forEach((d) => { if (rnd() < 0.3) Object.assign(s, DIMS[d](rnd)); });
  return s;
}
function shuffle(rnd, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const ids = (l) => l.map((e) => e.id);
const run = (fn) => {
  const rnd = mulberry32(SEED);
  for (let i = 0; i < STATES; i++) {
    const state = randomState(rnd);
    try { fn(state, rnd, i); }
    catch (err) { err.message = "seed " + SEED + ", state #" + i + " " + JSON.stringify(state) + "\n" + err.message; throw err; }
  }
};
const sameSet = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

test("entries.json has unique ids and enough entries", () => {
  assert.ok(ENTRIES.length > 1000);
  assert.equal(new Set(ids(ENTRIES)).size, ENTRIES.length);
});

test("matches returns a subset of the full list with no duplicates", () => {
  const all = new Set(ids(ENTRIES));
  run((state) => {
    const got = ids(ENTRIES.filter((e) => L.matches(e, state, NOW)));
    assert.equal(new Set(got).size, got.length, "duplicate ids");
    got.forEach((id) => assert.ok(all.has(id), "unknown id " + id));
  });
});

test("sortList and rank give a permutation, never mutate input, and are idempotent", () => {
  run((state) => {
    const list = ENTRIES.filter((e) => L.matches(e, state, NOW));
    const before = ids(list), snapshot = JSON.stringify(list);
    ["best", "deadline", "name"].forEach((mode) => {
      [undefined, { age: 15 }].forEach((profile) => {
        const out = L.sortList(list, mode, NOW, profile);
        assert.notEqual(out, list, "returned the same array");
        assert.deepEqual(ids(list), before, mode + " changed the input order");
        assert.equal(JSON.stringify(list), snapshot, mode + " changed an entry");
        assert.equal(out.length, list.length, mode + " lost or added cards");
        assert.equal(new Set(ids(out)).size, out.length, mode + " duplicated a card");
        sameSet(ids(out), before);
        assert.deepEqual(ids(L.sortList(out, mode, NOW, profile)), ids(out), mode + " is not idempotent");
      });
    });
    // rank is pure: the same entry gives the same key twice, and the key does not touch the entry.
    list.slice(0, 25).forEach((e) => assert.deepEqual(L.rank(e, NOW), L.rank(e, NOW)));
    assert.equal(JSON.stringify(list), snapshot, "rank changed an entry");
  });
});

test("sortList is stable: entries with equal keys keep their input order", () => {
  const list = ENTRIES.filter((e) => L.matches(e, { when: "anytime" }, NOW)).slice(0, 300);
  // Duplicate each entry under a new id: the copy has an identical key, so it must stay right after or in input order.
  const twins = list.flatMap((e) => [e, Object.assign({}, e, { id: e.id + "~twin" })]);
  const out = ids(L.sortList(twins, "best", NOW));
  list.forEach((e) => assert.ok(out.indexOf(e.id) < out.indexOf(e.id + "~twin"), "twin sorted before its original: " + e.id));
});

test("shuffling the input never changes the set matches returns", () => {
  run((state, rnd) => {
    const a = ids(ENTRIES.filter((e) => L.matches(e, state, NOW)));
    const b = ids(shuffle(rnd, ENTRIES).filter((e) => L.matches(e, state, NOW)));
    sameSet(a, b);
  });
});

test("adding a filter never increases the result count", () => {
  run((state, rnd) => {
    const count = (s) => ENTRIES.filter((e) => L.matches(e, s, NOW)).length;
    const base = count(state);
    const off = DIM_NAMES.filter((d) => !keysOf(d).some((k) => k in state));
    off.forEach((d) => {
      const next = Object.assign({}, state, DIMS[d](rnd));
      assert.ok(count(next) <= base, "adding " + d + " raised the count from " + base + " to " + count(next));
    });
  });
});
