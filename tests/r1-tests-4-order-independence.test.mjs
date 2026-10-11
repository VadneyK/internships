// Order independence: shuffling the input entries must not change what a teen sees.
// Seeded PRNG; the seed is printed in every failure message. Run with TEST_SEED=n to replay.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const NOW = new Date(2026, 9, 10).getTime();
const SEED = Number(process.env.TEST_SEED) || 20261010;
const SHUFFLES = 50;
const tag = " [seed=" + SEED + "]";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(list, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const rnd = mulberry32(SEED);
const SHUFFLED = Array.from({ length: SHUFFLES }, () => shuffled(ENTRIES, rnd));

// Insights lists that are sorted by count only. Equal counts keep input order, so compare them as id to count maps.
const asMap = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.n]));
function insightCounts(ins) {
  return {
    total: ins.total, status: ins.status, ages: ins.ages, hubs: ins.hubs, seasons: ins.seasons, facts: ins.facts,
    types: asMap(ins.types), fields: asMap(ins.fields),
    months: ins.months.map((m) => ({ key: m.key, label: m.label, n: m.n })),
  };
}

const STATES = [
  {},
  { age: 15 },
  { when: "open", age: 16 },
  { paid: ["paid"], noPermit: true },
  { types: ["volunteer"], verified: true },
  { q: "library" },
];

test("facetCounts is the same for 50 shuffles of the real entries", () => {
  for (const st of STATES) {
    const base = L.facetCounts(ENTRIES, st, NOW);
    SHUFFLED.forEach((l, i) => assert.deepEqual(L.facetCounts(l, st, NOW), base, "shuffle " + i + ", state " + JSON.stringify(st) + tag));
  }
});

test("placeCounts is the same for 50 shuffles of the real entries", () => {
  const base = L.placeCounts(ENTRIES);
  SHUFFLED.forEach((l, i) => assert.deepEqual(L.placeCounts(l), base, "shuffle " + i + tag));
});

test("insights counts are the same for 50 shuffles of the real entries", () => {
  const base = insightCounts(L.insights(ENTRIES, NOW));
  SHUFFLED.forEach((l, i) => assert.deepEqual(insightCounts(L.insights(l, NOW)), base, "shuffle " + i + tag));
});

/*
  Tie groups: runs of neighbours the sort cannot tell apart. The sort has no id tie-break, so inside a group the
  order follows the input order. The allow-list names each reason a tie is accepted. A tie that matches no reason fails.
*/
const TIE_ALLOW_LIST = {
  "same-name": {
    reason: "Different programs in different cities that share one exact name (for example Teen Volunteer Program). Sorting uses the name as its last key and nothing after it, so only the order inside the group may vary.",
    test: (group) => group.every((e) => e.name === group[0].name),
  },
};
const sortKeyEqual = {
  name: (a, b) => a.name.localeCompare(b.name) === 0,
  best: (a, b) => L.compare(a, b, NOW) === 0,
  deadline: (a, b) => L.compare(a, b, NOW) === 0,
};
function tieGroups(sorted, mode) {
  const groups = []; let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sortKeyEqual[mode](sorted[i - 1], sorted[i])) cur.push(sorted[i]);
    else { if (cur.length > 1) groups.push(cur); cur = [sorted[i]]; }
  }
  if (cur.length > 1) groups.push(cur);
  return groups;
}
const ids = (l) => l.map((e) => e.id);

for (const mode of ["best", "name", "deadline"]) {
  test("sortList '" + mode + "' gives the same order for 50 shuffles, up to allow-listed ties", () => {
    const base = L.sortList(ENTRIES, mode, NOW);
    const baseIds = ids(base);
    const groups = tieGroups(base, mode);
    for (const g of groups) {
      const why = Object.keys(TIE_ALLOW_LIST).find((k) => TIE_ALLOW_LIST[k].test(g));
      assert.ok(why, "tie group is not on the allow-list: " + ids(g).join(", ") + tag);
    }
    const groupOf = new Map();
    groups.forEach((g, gi) => g.forEach((e) => groupOf.set(e.id, gi)));
    SHUFFLED.forEach((l, s) => {
      const got = ids(L.sortList(l, mode, NOW));
      assert.equal(got.length, baseIds.length, "length, shuffle " + s + tag);
      // Outside tie groups every position must hold the same id; inside a group the set of ids must match.
      for (let i = 0; i < baseIds.length; i++) {
        const gi = groupOf.get(baseIds[i]);
        if (gi === undefined) assert.equal(got[i], baseIds[i], mode + " position " + i + ", shuffle " + s + tag);
        else assert.equal(groupOf.get(got[i]), gi, mode + " position " + i + " should hold a member of tie group " + gi + ", shuffle " + s + tag);
      }
    });
  });
}

test("insights month items for the same date are sorted by date then id", () => {
  const check = (ins, label) => {
    for (const m of ins.months) {
      for (let i = 1; i < m.items.length; i++) {
        const a = m.items[i - 1], b = m.items[i];
        const ok = a.date < b.date || (a.date === b.date && a.id < b.id);
        assert.ok(ok, "insights month '" + m.label + "' is not sorted by date then id (" + a.date + " " + a.id + " before " + b.date + " " + b.id + ", " + label + "). " +
          "The comparator in insights() returns 1 for equal dates, so equal dates follow input order. It needs an id tie-break; lane lead to file a code fix." + tag);
      }
    }
  };
  check(L.insights(ENTRIES, NOW), "unshuffled");
  SHUFFLED.slice(0, 5).forEach((l, i) => check(L.insights(l, NOW), "shuffle " + i));
});
