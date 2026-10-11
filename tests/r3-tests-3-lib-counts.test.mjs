// Property tests for the lib.js helpers behind the filter chip counts, Relax help and Good fit strip.
// Real entries.json, a seeded PRNG, plain node (no jsdom).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const L = require(path.join(ROOT, "assets/js/lib.js"));
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const NOW = new Date(2026, 9, 10);

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = prng(20261010);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const some = (arr, max) => {
  const n = Math.floor(rnd() * (max + 1)), out = [];
  for (let i = 0; i < n; i++) { const v = pick(arr); if (!out.includes(v)) out.push(v); }
  return out;
};
const WORDS = ["", "", "", "art", "paid", "camp", "science", "library", "intern", "summer", "volunteer", "city", "zzzz", "health"];
const places = [...L.CITIES.map((c) => "city:" + c[0]), ...L.AREAS.map((a) => "area:" + a[0])];
const typeIds = Object.keys(L.TYPES), fieldIds = Object.keys(L.FIELDS).filter((k) => k !== "any");
const hubIds = L.HUBS.map((h) => h[0]), paidIds = L.PAID_GROUPS.map((g) => g[0]);

function randomState() {
  const s = {};
  if (rnd() < 0.7) s.age = 12 + Math.floor(rnd() * 7);
  if (rnd() < 0.3) s.place = pick(places);
  if (rnd() < 0.2) s.hubs = some(hubIds, 2);
  if (rnd() < 0.3) s.types = some(typeIds, 2);
  if (rnd() < 0.3) s.fields = some(fieldIds, 2);
  if (rnd() < 0.3) s.paid = some(paidIds, 2);
  if (rnd() < 0.3) s.season = pick(["summer", "school-year", "fall", "winter", "spring", "year-round"]);
  if (rnd() < 0.4) s.when = pick(["open", "60", "anytime", "closed"]);
  if (rnd() < 0.15) s.verified = true;
  if (rnd() < 0.15) s.noPermit = true;
  const q = pick(WORDS); if (q) s.q = q;
  return s;
}
const STATES = Array.from({ length: 300 }, randomState);
const count = (s) => entries.filter((e) => L.matches(e, s, NOW)).length;

test("facetCounts equals matches() with that one chip chosen", () => {
  for (const st of STATES) {
    const fc = L.facetCounts(entries, st, NOW);
    for (const h of hubIds) assert.equal(fc.hubs[h], count({ ...st, hubs: [h], place: "" }), "hub " + h);
    for (const p of paidIds) assert.equal(fc.paid[p], count({ ...st, paid: [p] }), "paid " + p);
    for (const t of typeIds) assert.equal(fc.types[t], count({ ...st, types: [t] }), "type " + t);
    for (const f of fieldIds) assert.equal(fc.fields[f], count({ ...st, fields: [f] }), "field " + f);
  }
});

test("single-choice facets (type, paid group) add up to the count with that facet cleared", () => {
  // Every card has exactly one type and one paid_type, and every paid_type is in exactly one group.
  // Hubs and fields are not additive: a card can sit in several hubs and carry several fields.
  for (const st of STATES) {
    const fc = L.facetCounts(entries, st, NOW);
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    assert.equal(sum(fc.types), count({ ...st, types: [] }));
    assert.equal(sum(fc.paid), count({ ...st, paid: [] }));
  }
  assert.equal(count({}), entries.length);
});

test("placeCounts equals matches() for every city and area", () => {
  const pc = L.placeCounts(entries);
  assert.deepEqual(Object.keys(pc).sort(), [...places].sort());
  for (const p of places) assert.equal(pc[p], count({ place: p }), p);
});

test("relaxOptions: each suggestion, applied, gives strictly more cards and never fewer than 1", () => {
  const RELAXABLE = ["q", "age", "when", "season", "paid", "types", "fields", "verified", "noPermit", "hubs", "place"];
  let checked = 0, strictChecked = 0;
  for (const st of STATES) {
    const now = count(st), opts = L.relaxOptions(entries, st, NOW);
    assert.ok(opts.length <= 3);
    for (const o of opts) {
      assert.ok(RELAXABLE.includes(o.key), o.key);
      assert.ok(o.label && typeof o.label === "string");
      const s = { ...st };
      s[o.key] = Array.isArray(st[o.key]) ? [] : typeof st[o.key] === "boolean" ? false : "";
      // Same widening rule as the Programs page: a place with fewer than 3 matches also shows online programs.
      let n = count(s);
      if (s.place && n < 3) n = count({ ...s, placeOnline: true });
      assert.equal(n, o.count, "count for " + o.key);
      assert.ok(o.count >= 1);
      // Relax is the empty-state help, so when there are 0 cards every suggestion must show more.
      // With cards already showing, relaxOptions keeps any option above 0, so a filter that changes nothing
      // can be suggested (count equal to now). Never fewer is the rule that holds there. See the note in the reply.
      if (now === 0) assert.ok(o.count > now, o.key + " gives " + o.count + " but now " + now);
      else assert.ok(o.count >= now, o.key + " gives " + o.count + " but now " + now);
      if (now === 0) strictChecked++;
      checked++;
    }
    for (let i = 1; i < opts.length; i++) assert.ok(opts[i - 1].count >= opts[i].count);
  }
  assert.ok(strictChecked > 10, "empty states were exercised: " + strictChecked);
  assert.ok(checked > 50, "enough suggestions were exercised: " + checked);
});

test("topPicks: at most n, no duplicate ids, only cards that match the filter", () => {
  for (const st of STATES) {
    const list = entries.filter((e) => L.matches(e, st, NOW));
    for (const n of [0, 1, 3, 6, 50]) {
      const out = L.topPicks(list, { age: st.age }, NOW, n);
      assert.ok(out.length <= n);
      const ids = out.map((e) => e.id);
      assert.equal(new Set(ids).size, ids.length);
      for (const e of out) assert.ok(L.matches(e, st, NOW), e.id);
      assert.ok(!out.some((e) => e.paid_type === "fee-based"));
    }
    assert.ok(L.topPicks(list, { age: st.age }, NOW).length <= 3);
  }
});

test("regionLabel: readable label for every region, safe fallback otherwise", () => {
  assert.ok(L.REGIONS.length > 0);
  for (const r of L.REGIONS) {
    const lab = L.regionLabel(r[0]);
    assert.equal(typeof lab, "string");
    assert.ok(lab.trim().length > 0, r[0]);
    assert.equal(lab, r[1]);
  }
  for (const bad of ["nowhere", "", null, undefined, 42, {}, "__proto__", "constructor"]) assert.equal(L.regionLabel(bad), "");
  for (const e of entries) for (const r of e.regions || []) assert.ok(L.regionLabel(r), "entry " + e.id + " region " + r);
});

test("toISO round trips through parseISO for every day 2026 to 2028", () => {
  let days = 0;
  for (let d = new Date(2026, 0, 1); d.getFullYear() <= 2028; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const iso = L.toISO(d);
    assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
    const back = L.parseISO(iso);
    assert.ok(back, iso);
    assert.equal(back.getTime(), d.getTime(), iso);
    assert.equal(L.toISO(back), iso);
    days++;
  }
  assert.equal(days, 365 + 365 + 366);
  for (const bad of [null, undefined, "", "2027-02-30", "2026-13-01", "2026-1-1", "soon", 20261010, {}]) assert.equal(L.parseISO(bad), null, String(bad));
});

test("isAnytime and knownDeadline agree with status and deadline_confidence for every card", () => {
  const ANY = ["rolling", "year-round", "event"];
  const today = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  for (const e of entries) {
    const st = L.effStatus(e, NOW);
    assert.equal(L.isAnytime(e, NOW), ANY.includes(st), e.id);
    assert.ok(!(L.isAnytime(e, NOW) && L.isOpenish(e, NOW)), e.id);
    const k = L.knownDeadline(e, NOW), f = L.futureDeadline(e, NOW);
    if (f) assert.equal(k && k.getTime(), f.getTime(), e.id);
    if (k) {
      assert.ok(k >= today, e.id);
      assert.equal(L.toISO(k), e.deadline_iso, e.id);
      if (!f) {
        assert.ok(st === "closed-expect-reopen" || st === "unconfirmed", e.id);
        assert.equal(e.deadline_confidence, "confirmed-2026-27", e.id);
      }
    }
    if (!k && e.deadline_confidence === "confirmed-2026-27" && (st === "closed-expect-reopen" || st === "unconfirmed")) {
      const d = L.parseISO(e.deadline_iso);
      assert.ok(!d || d < today, e.id + " has a confirmed future date but no known deadline");
    }
  }
});
