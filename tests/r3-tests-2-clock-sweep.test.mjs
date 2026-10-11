// r3-tests-2: clock sweep. Status, sort and counts hold their rules on every day from 2026-10-10 to 2027-12-31.
// No real clock: every "now" is built from a fixed calendar day. Fixed seed for the card sample.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lib = createRequire(import.meta.url)(join(root, "assets/js/lib.js"));
const ALL = JSON.parse(readFileSync(join(root, "data/entries.json"), "utf8"));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261010);
const shuffled = ALL.slice();
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
const withDeadline = ALL.filter((e) => e.deadline_iso);
const daily = Array.from(new Set(shuffled.slice(0, 200).concat(withDeadline)));

// Local noon of each day, so the day is the same in any time zone and across daylight saving changes.
const DAYS = [];
for (let d = new Date(2026, 9, 10, 12); d <= new Date(2027, 11, 31, 12); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12)) DAYS.push(new Date(d));
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

test("sweep covers the expected span and cards", () => {
  assert.equal(DAYS.length, 448);
  assert.equal(ALL.length, 1771); // the guide grew from 1,370 to 1,771 programs on 2026-10-10
  assert.ok(daily.length >= 200);
});

test("daily sweep: status, deadline and day count rules", () => {
  const bad = [];
  const prevDays = new Map();
  DAYS.forEach((now, di) => {
    const today = iso(now);
    for (const e of daily) {
      const st = lib.effStatus(e, now);
      const past = !!e.deadline_iso && e.deadline_iso < today;
      if (past && (st === "open-now" || st === "opens-soon" || st === "rolling")) bad.push("status " + e.id + " " + today + " " + st);
      const fd = lib.futureDeadline(e, now);
      if (fd) {
        if (!e.deadline_iso || e.deadline_iso < today) bad.push("future " + e.id + " " + today);
        const n = lib.daysUntil(fd, now);
        if (!Number.isInteger(n) || n < 0) bad.push("days " + e.id + " " + today + " " + n);
        const p = prevDays.get(e.id);
        if (p && p.di === di - 1 && p.n - n !== 1) bad.push("step " + e.id + " " + today + " " + p.n + "->" + n);
        prevDays.set(e.id, { di, n });
      } else prevDays.delete(e.id);
      if (!fd && e.deadline_iso && e.deadline_iso >= today && ["open-now", "opens-soon", "rolling", "event"].includes(st)) bad.push("missing future " + e.id + " " + today);
      assert.equal(lib.isOpenish(e, now), st === "open-now" || st === "opens-soon");
    }
    if (bad.length > 20) return;
  });
  assert.deepEqual(bad.slice(0, 20), []);
});

test("weekly sweep: every card, status rules", () => {
  const bad = [];
  for (let di = 0; di < DAYS.length; di += 7) {
    const now = DAYS[di], today = iso(now);
    for (const e of ALL) {
      const st = lib.effStatus(e, now);
      if (e.deadline_iso && e.deadline_iso < today && (st === "open-now" || st === "opens-soon" || st === "rolling")) bad.push(e.id + " " + today + " " + st);
      const fd = lib.futureDeadline(e, now);
      if (fd && iso(fd) < today) bad.push("future " + e.id + " " + today);
      if (fd) assert.ok(Number.isInteger(lib.daysUntil(fd, now)));
      assert.equal(lib.isOpenish(e, now), st === "open-now" || st === "opens-soon");
    }
  }
  assert.deepEqual(bad.slice(0, 20), []);
});

const ids = (l) => l.map((e) => e.id);
test("weekly sweep: sortList and topPicks keep every card and stay stable", () => {
  const sortedIds = ids(ALL).slice().sort();
  const profiles = [undefined, { age: 15 }];
  for (let di = 0; di < DAYS.length; di += 7) {
    const now = DAYS[di];
    for (const mode of ["best", "deadline", "name"]) {
      for (const prof of profiles) {
        const a = lib.sortList(ALL, mode, now, prof);
        assert.equal(a.length, ALL.length, mode + " length " + iso(now));
        assert.deepEqual(ids(a).slice().sort(), sortedIds, mode + " lost or duplicated " + iso(now));
        assert.deepEqual(ids(lib.sortList(ALL, mode, now, prof)), ids(a), mode + " not repeatable " + iso(now));
        assert.deepEqual(ids(lib.sortList(a, mode, now, prof)), ids(a), mode + " not idempotent " + iso(now));
      }
    }
    for (const prof of [undefined, { age: 13 }, { age: 16 }]) {
      const t = lib.topPicks(ALL, prof, now, 5);
      assert.ok(t.length <= 5);
      assert.equal(new Set(ids(t)).size, t.length);
      assert.deepEqual(ids(lib.topPicks(ALL, prof, now, 5)), ids(t));
      for (const e of t) assert.ok(["open-now", "opens-soon", "rolling", "year-round"].includes(lib.effStatus(e, now)));
    }
    const all = lib.topPicks(ALL, undefined, now, ALL.length);
    assert.equal(new Set(ids(all)).size, all.length);
  }
});

test("weekly sweep: adding a filter never grows the match count", () => {
  const count = (s, now) => ALL.filter((e) => lib.matches(e, s, now)).length;
  const bases = [{}, { age: 15 }, { when: "open" }, { when: "60" }, { hubs: [] }];
  const extras = [{ when: "open" }, { when: "60" }, { when: "anytime" }, { when: "closed" }, { age: 14 }, { season: "summer" }, { types: ["paid-youth-program"] }, { paid: ["paid"] }, { fields: ["arts-media"] }];
  for (let di = 0; di < DAYS.length; di += 7) {
    const now = DAYS[di];
    for (const base of bases) {
      const n0 = count(base, now);
      assert.ok(n0 <= ALL.length);
      for (const x of extras) {
        if (x.when && base.when) continue;
        if (x.age && base.age) continue;
        const merged = Object.assign({}, base, x);
        assert.ok(count(merged, now) <= n0, JSON.stringify(merged) + " grew on " + iso(now));
      }
    }
  }
});
