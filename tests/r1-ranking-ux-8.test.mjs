// First-screen guarantees over the real data (ticket r1-ranking-ux-8).
// The ranking, the place picker and the empty states change often as data grows. These checks run over every
// real entry in data/entries.json with a fixed "today" (2026-10-10), so a dead end or a bad order fails here
// before it ships.
// Run with: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const NOW = new Date(2026, 9, 10); // 2026-10-10, local midnight
const PAGE = 60; // find.js shows this many cards before "Show more"

const ids = (list) => list.map((e) => e.id);
const placeKey = (kind, id) => kind + ":" + id;

// (a) Dead ends ------------------------------------------------------------------------------------------------
// ALLOWED_DEAD_ENDS lists every "place@age" combination that is allowed to return 0 programs. It is empty today:
// every city and area has at least one program for every age from 12 to 18. If new data or a rule change makes a
// combination empty, this test fails on purpose. The owner must then decide: add programs, or add the combination
// here knowing the page shows its "Nothing matches yet" explanation (and, for a city, the online fallback note).
// Format: "city:<id>@<age>" or "area:<id>@<age>", kept in sorted order.
const ALLOWED_DEAD_ENDS = [];

test("(a) every city and area has results for every age 12 to 18, except the allow-list", () => {
  const dead = [];
  const places = [
    ...L.CITIES.map((c) => placeKey("city", c[0])),
    ...L.AREAS.map((a) => placeKey("area", a[0])),
  ];
  assert.ok(places.length >= 40, "expected the full picker list, got " + places.length);
  for (const place of places) {
    assert.ok(L.placeRegions(place), "place " + place + " does not resolve to regions");
    for (let age = 12; age <= 18; age++) {
      const n = DATA.filter((e) => L.matches(e, { place, age }, NOW)).length;
      if (n === 0) dead.push(place + "@" + age);
    }
  }
  dead.sort();
  assert.deepEqual(dead, [...ALLOWED_DEAD_ENDS].sort(), "dead ends changed. Add programs, or decide and edit ALLOWED_DEAD_ENDS");
});

// (b) Order of the first 12 --------------------------------------------------------------------------------------
// Ages 12, 14, 16 and 18 with four places. L.CITIES has no "online" city (online programs are the fallback the page
// adds on its own), so the online case is the no-place list, which is every online, national and local program.
const PLACES = [
  { label: "berkeley", place: "city:berkeley" },
  { label: "atlanta area", place: "city:atlanta" },
  { label: "new york", place: "city:new-york-city" },
  { label: "online (no place)", place: "" },
];
const AGES = [12, 14, 16, 18];
const feeBased = (e) => e.paid_type === "fee-based";
// The deadline bucket comes first on purpose (ticket r1-ranking-ux-1), so a fee-based program due within 21 days may lead.
const soon = (e) => { const d = L.futureDeadline(e, NOW); return !!d && L.daysUntil(d, NOW) <= 21; };

test("(b) first 12 of the best sort: all fit the age, and fee-based programs never sit above free or paid ones of the same status", () => {
  for (const p of PLACES) {
    for (const age of AGES) {
      const state = p.place ? { place: p.place, age } : { age };
      const matched = DATA.filter((e) => L.matches(e, state, NOW));
      assert.ok(matched.length >= 12, p.label + " age " + age + ": only " + matched.length + " programs, need 12 to check");
      const sorted = L.sortList(matched, "best", NOW);
      const first = sorted.slice(0, 12);
      for (const e of first) assert.ok(L.ageOk(e, age), p.label + " age " + age + ": " + e.id + " does not fit the age");
      first.forEach((e, i) => {
        if (!feeBased(e) || soon(e)) return;
        const status = L.effStatus(e, NOW);
        // The group (has a deadline, no deadline, anytime, closed) is the first key, so compare inside one group.
        const group = L.rank(e, NOW)[0];
        const later = sorted.slice(i + 1).find((o) => !feeBased(o) && L.effStatus(o, NOW) === status && L.rank(o, NOW)[0] === group);
        assert.equal(
          later,
          undefined,
          p.label + " age " + age + ": fee-based " + e.id + " is at " + (i + 1) + " but " + (later && later.id) + " (not fee-based, same status " + status + ") comes later",
        );
      });
    }
  }
});

// (c) Same output for any input order ------------------------------------------------------------------------
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0; // mulberry32
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(list, seed) {
  const a = list.slice();
  const rnd = seededRandom(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

test("(c) the sort gives the same order for reversed and seeded-shuffled input", () => {
  // Array.sort is stable, so two programs that share every sort key (same name, deadline, pay and status) keep the
  // input order by design. Keep one of each such group so the check is about the sort, not about duplicates.
  const seen = new Set();
  const distinct = DATA.filter((e) => {
    const d = L.futureDeadline(e, NOW);
    const k = e.name; // the name sort ties on the name alone, and every other key ends with the name
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  assert.ok(distinct.length > DATA.length * 0.9, "most real programs have a distinct sort key");
  for (const mode of ["best", "deadline", "name"]) {
    const base = ids(L.sortList(distinct, mode, NOW));
    assert.deepEqual(ids(L.sortList(distinct.slice().reverse(), mode, NOW)), base, mode + ": reversed input changed the order");
    for (const seed of [1, 2026, 101010]) {
      assert.deepEqual(ids(L.sortList(shuffled(distinct, seed), mode, NOW)), base, mode + ": shuffle with seed " + seed + " changed the order");
    }
  }
});

// (d) Show more ----------------------------------------------------------------------------------------------
test("(d) page two of Show more (items 61 to 120) starts right after item 60 with no repeats", () => {
  const sorted = ids(L.sortList(DATA, "best", NOW));
  assert.ok(sorted.length >= 120, "need at least 120 programs, have " + sorted.length);
  const pageOne = sorted.slice(0, PAGE);
  const pageTwo = sorted.slice(PAGE, 2 * PAGE);
  assert.equal(pageTwo.length, PAGE);
  // The page renders the first `shown` items of the same list, so after one click it shows exactly items 1 to 120.
  assert.deepEqual([...pageOne, ...pageTwo], sorted.slice(0, 2 * PAGE));
  assert.equal(pageTwo[0], sorted[PAGE], "item 61 must be the item right after item 60");
  assert.notEqual(pageTwo[0], pageOne[PAGE - 1]);
  assert.equal(new Set([...pageOne, ...pageTwo]).size, 2 * PAGE, "an id repeats in the first 120");
});

// (e) The real first screen ----------------------------------------------------------------------------------
test("(e) the default first screen shows min(60, total) cards, the count line, and no console errors", async () => {
  const total = DATA.length;
  const { window, document, errors } = await loadPage("find.html", { now: NOW.getTime() });
  try {
    const cards = document.querySelectorAll("#out article.prog").length;
    assert.equal(cards, Math.min(PAGE, total), "first screen card count");
    const count = document.getElementById("count");
    assert.ok(count, "no element with id count");
    assert.match(count.textContent.trim(), new RegExp("^" + total + " of " + total + " programs$"));
    assert.deepEqual(errors, [], "console errors on the first screen");
  } finally {
    window.close();
  }
});
