// Property-style checks of lib.js against every real program.
// Run with: node --test tests/r1-tests-5.test.mjs
// To repeat a failing run, set the seed: TIG_SEED=12345 node --test tests/r1-tests-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ENTRIES = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

const SEED = Number(process.env.TIG_SEED) || (Date.now() % 2147483647) || 1;
const DRAWS = 200;
const NOWS = [
  new Date(2026, 9, 9), new Date(2026, 11, 15), new Date(2027, 1, 20), new Date(2027, 3, 10), new Date(2027, 5, 1)
].map((d) => d.getTime());
const SORT_MODES = ["name", "deadline", "rank", undefined];

// Small seeded generator (mulberry32). No dependency.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(SEED);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
function pickSome(arr, max) {
  const n = 1 + Math.floor(rng() * max), out = [];
  while (out.length < n && out.length < arr.length) { const v = pick(arr); if (out.indexOf(v) === -1) out.push(v); }
  return out;
}

const HUB_IDS = L.HUBS.map((h) => h[0]);
const PAID_IDS = L.PAID_GROUPS.map((g) => g[0]);
const TYPE_IDS = Object.keys(L.TYPES);
const FIELD_IDS = Object.keys(L.FIELDS);
const SEASONS = ["summer", "school-year", "fall", "winter", "spring"];
const WHENS = ["open", "60", "anytime", "closed"];

function randomQuery() {
  for (let tries = 0; tries < 20; tries++) {
    const words = pick(ENTRIES).name.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, "")).filter(Boolean);
    if (!words.length) continue;
    const n = Math.min(words.length, 1 + Math.floor(rng() * 2));
    const start = Math.floor(rng() * (words.length - n + 1));
    return words.slice(start, start + n).join(" ");
  }
  return "";
}

// A draw is a list of restrictions. Each one adds a single key to the filter state.
function randomRestrictions() {
  const all = [
    () => ["age", 12 + Math.floor(rng() * 7)],
    () => ["hubs", pickSome(HUB_IDS, 3)],
    () => ["paid", pickSome(PAID_IDS, 2)],
    () => ["types", pickSome(TYPE_IDS, 3)],
    () => ["fields", pickSome(FIELD_IDS, 3)],
    () => ["season", pick(SEASONS)],
    () => ["when", pick(WHENS)],
    () => ["verified", true],
    () => ["noPermit", true],
    () => ["q", randomQuery()]
  ];
  const chosen = all.filter(() => rng() < 0.4).map((f) => f());
  // Fisher-Yates so the order of adding restrictions varies too.
  for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }
  return chosen;
}
const stateOf = (rs) => { const s = {}; rs.forEach(([k, v]) => { s[k] = v; }); return s; };

function assertNoNaN(v, path) {
  if (typeof v === "number") assert.ok(!Number.isNaN(v), "NaN at " + path);
  else if (Array.isArray(v)) v.forEach((x, i) => assertNoNaN(x, path + "[" + i + "]"));
  else if (v && typeof v === "object") Object.keys(v).forEach((k) => assertNoNaN(v[k], path + "." + k));
}
const ids = (l) => l.map((e) => e.id);
function isSubset(small, big) { const b = new Set(ids(big)); return ids(small).every((id) => b.has(id)); }

test("data: all real programs load", () => {
  assert.ok(Array.isArray(ENTRIES));
  const files = readdirSync(new URL("../data/programs/", import.meta.url)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  assert.equal(ENTRIES.length, files.length, "seed " + SEED);
  assert.equal(new Set(ids(ENTRIES)).size, ENTRIES.length, "ids are unique");
});

test("lib.js invariants hold on " + DRAWS + " random filter states x 5 dates", () => {
  const started = Date.now();
  let draw = 0, now = NOWS[0];
  try {
    for (draw = 0; draw < DRAWS; draw++) {
      now = NOWS[draw % NOWS.length];
      const rs = randomRestrictions();
      const full = stateOf(rs);

      // matches never throws, and the filtered list is monotone as restrictions are added.
      let prev = ENTRIES.slice();
      for (let k = 1; k <= rs.length; k++) {
        const cur = ENTRIES.filter((e) => L.matches(e, stateOf(rs.slice(0, k)), now));
        assert.ok(cur.length <= prev.length, "adding restriction " + rs[k - 1][0] + " grew the list");
        assert.ok(isSubset(cur, prev), "restriction " + rs[k - 1][0] + " added programs");
        prev = cur;
      }
      // Removing any one restriction never shrinks the result.
      const list = prev;
      rs.forEach((r, i) => {
        const without = ENTRIES.filter((e) => L.matches(e, stateOf(rs.filter((_, j) => j !== i)), now));
        assert.ok(isSubset(list, without), "dropping " + r[0] + " lost programs");
      });

      // sortList is a permutation of its input for every mode, and does not change the input.
      const before = ids(list).join("|");
      SORT_MODES.forEach((mode) => {
        const sorted = L.sortList(list, mode, now);
        assert.equal(sorted.length, list.length, "sort " + mode + " changed length");
        assert.deepEqual(ids(sorted).slice().sort(), ids(list).slice().sort(), "sort " + mode + " is not a permutation");
      });
      assert.equal(ids(list).join("|"), before, "sortList changed its input");

      // effStatus and futureDeadline over every real program.
      const today = new Date(now); today.setHours(0, 0, 0, 0);
      ENTRIES.forEach((e) => {
        const st = L.effStatus(e, now);
        assert.equal(L.effStatus({ ...e, status: st }, now), st, e.id + " effStatus not idempotent");
        const dl = L.parseISO(e.deadline_iso);
        if (dl && dl < today) {
          assert.ok(st !== "open-now" && st !== "opens-soon", e.id + " is " + st + " after its deadline");
        }
        const fd = L.futureDeadline(e, now);
        assert.ok(fd === null || fd >= today, e.id + " futureDeadline is in the past");
      });

      // insights counts add up and contain no NaN.
      const ins = L.insights(list, now);
      assertNoNaN(ins, "insights");
      assert.equal(ins.total, list.length);
      assert.equal(ins.status.reduce((a, g) => a + g.n, 0), list.length, "status groups do not sum to the list");
      assert.equal(ins.ages.length, 6);
      ins.ages.forEach((a) => {
        assert.ok(a.age >= 13 && a.age <= 18);
        assert.ok(a.n >= 0 && a.n <= list.length, "age " + a.age + " n out of range");
        assert.ok(a.paid >= 0 && a.paid <= a.n, "age " + a.age + " paid out of range");
      });
      ins.hubs.forEach((h) => {
        assert.ok(h.n >= 1 && h.n <= list.length, "hub " + h.id + " n out of range");
        L.PAID_GROUPS.forEach((g) => assert.ok(h[g[0]] >= 0 && h[g[0]] <= h.n, "hub " + h.id + " " + g[0] + " out of range"));
      });
      assert.equal(ins.seasons.reduce((a, s) => a + s.n, 0), list.length, "seasons do not sum to the list");
      assert.equal(ins.types.reduce((a, t) => a + t.n, 0), list.length, "types do not sum to the list");
      assert.ok(ins.months.reduce((a, m) => a + m.n, 0) <= list.length, "months exceed the list");
    }
  } catch (err) {
    err.message += "\n  (seed " + SEED + ", draw " + draw + ", now " + new Date(now).toISOString() + "; repeat with TIG_SEED=" + SEED + ")";
    console.error("FAILED with seed " + SEED + " at draw " + draw);
    throw err;
  }
  const ms = Date.now() - started;
  assert.ok(ms < 10000, "took " + ms + " ms, limit is 10000 (seed " + SEED + ")");
});

test("effStatus never leaves a program open past a deadline, even if the data says so", () => {
  // Stress the real entries: force every one to look open with a deadline the day before each date.
  NOWS.forEach((now) => {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    const iso = L.toISO(d);
    ENTRIES.forEach((e) => {
      ["open-now", "opens-soon"].forEach((status) => {
        const copy = { ...e, status, deadline_iso: iso };
        const st = L.effStatus(copy, now);
        assert.ok(st !== "open-now" && st !== "opens-soon", e.id + " stayed " + st + " (seed " + SEED + ")");
        assert.equal(L.futureDeadline(copy, now), null, e.id + " kept a past deadline (seed " + SEED + ")");
      });
    });
  });
});
