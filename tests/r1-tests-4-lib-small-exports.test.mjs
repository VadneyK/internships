// Direct edge-case tests for the small lib.js exports: MONTH_NAMES, PICK_GROUPS, STATUSES,
// fmtDate, placeLabel, stateFromPlace, hubsOf and hubsOfPlace.
// Run with: node --test tests/r1-tests-4-lib-small-exports.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const CITY_PLACES = L.CITIES.map((c) => "city:" + c[0]);
const AREA_PLACES = L.AREAS.map((a) => "area:" + a[0]);
const ALL_PLACES = [...CITY_PLACES, ...AREA_PLACES];

/* ---------- MONTH_NAMES ---------- */

test("MONTH_NAMES: 12 distinct non-empty names that agree with MONTHS", () => {
  assert.equal(L.MONTH_NAMES.length, 12);
  assert.equal(new Set(L.MONTH_NAMES).size, 12, "names must be distinct");
  L.MONTH_NAMES.forEach((name, i) => {
    assert.ok(name.length > 0, "name " + i + " is empty");
    assert.equal(L.MONTHS[i], name.slice(0, 3), "MONTHS[" + i + "] should be the short form of " + name);
  });
});

/* ---------- PICK_GROUPS ---------- */

test("PICK_GROUPS: every id is a real city or area, and no city or area is listed twice", () => {
  const cityIds = L.CITIES.map((c) => c[0]);
  const areaIds = L.AREAS.map((a) => a[0]);
  assert.equal(new Set(cityIds).size, cityIds.length, "CITIES has a duplicate id");
  const seenCities = [];
  const seenAreas = [];
  for (const [label, areas, cities] of L.PICK_GROUPS) {
    assert.ok(label.length > 0, "group with an empty label");
    for (const a of areas) {
      assert.ok(areaIds.includes(a), "unknown area id " + a + " in group " + label);
      seenAreas.push(a);
    }
    for (const c of cities) {
      assert.ok(cityIds.includes(c), "unknown city id " + c + " in group " + label);
      seenCities.push(c);
    }
  }
  assert.equal(new Set(seenAreas).size, seenAreas.length, "an area is listed in two groups or twice");
  assert.equal(new Set(seenCities).size, seenCities.length, "a city is listed in two groups or twice");
  assert.deepEqual([...new Set(seenCities)].sort(), [...cityIds].sort(), "every city is in exactly one group");
});

/* ---------- STATUSES ---------- */

test("STATUSES: outreach statuses have no duplicate keys, a label for each, and start with Not sent yet", () => {
  const keys = L.STATUSES.map((s) => s[0]);
  assert.equal(new Set(keys).size, keys.length, "duplicate status key");
  assert.equal(keys[0], "", "the first status is the empty 'not sent yet' value");
  for (const [key, label] of L.STATUSES) {
    assert.equal(typeof key, "string", "key is not a string");
    assert.ok(label.length > 0, "status " + JSON.stringify(key) + " has no label");
  }
  assert.deepEqual(keys, ["", "sent", "replied", "meeting", "thanked"]);
});

/* ---------- fmtDate ---------- */

test("fmtDate: every month formats as 'Mon D, YYYY'", () => {
  for (let m = 0; m < 12; m++) {
    assert.equal(L.fmtDate(new Date(2026, m, 15)), L.MONTHS[m] + " 15, 2026", "month index " + m);
  }
});

test("fmtDate: a leap day, a year end and a date from parseISO", () => {
  assert.equal(L.fmtDate(new Date(2028, 1, 29)), "Feb 29, 2028");
  assert.equal(L.fmtDate(L.parseISO("2028-02-29")), "Feb 29, 2028");
  assert.equal(L.fmtDate(new Date(2026, 11, 31)), "Dec 31, 2026");
  assert.equal(L.fmtDate(new Date(2027, 0, 1)), "Jan 1, 2027");
});

test("fmtDate: bad input returns an empty string and never prints undefined or NaN", () => {
  const bad = [null, undefined, "", "abc", "2026-13-01", L.parseISO("2026-13-01"), new Date("nope"), 0, {}];
  for (const v of bad) {
    const s = L.fmtDate(v);
    assert.equal(s, "", "input " + String(v));
    assert.ok(!/undefined|NaN/.test(s), "no undefined or NaN in output");
  }
});

/* ---------- placeLabel ---------- */

test("placeLabel: a non-empty label for every known city and area, matching the table", () => {
  for (const c of L.CITIES) assert.equal(L.placeLabel("city:" + c[0]), c[1], "city " + c[0]);
  for (const a of L.AREAS) assert.equal(L.placeLabel("area:" + a[0]), a[1], "area " + a[0]);
  for (const p of ALL_PLACES) assert.ok(L.placeLabel(p).length > 0, "empty label for " + p);
});

test("placeLabel: unknown, malformed, null and undefined ids return an empty string", () => {
  for (const bad of ["", "city:nowhere", "area:nowhere", "city:", "area:", "boston", "county:boston", null, undefined, 5, {}]) {
    assert.equal(L.placeLabel(bad), "", "input " + String(bad));
  }
});

/* ---------- stateFromPlace ---------- */

test("stateFromPlace: every city gives a two-letter state code", () => {
  for (const p of CITY_PLACES) {
    assert.match(L.stateFromPlace(p), /^[a-z]{2}$/, p);
  }
});

test("stateFromPlace: an area inside one state gives its code, an area across states gives empty", () => {
  assert.equal(L.stateFromPlace("area:bay-area"), "ca");
  assert.equal(L.stateFromPlace("state:texas"), "tx"); // 2026-10-15: the Texas area was removed; All of Texas is the state choice
  assert.equal(L.stateFromPlace("area:midwest"), "", "midwest spans several states");
  assert.equal(L.stateFromPlace("area:west-coast"), "", "west coast spans several states");
  for (const p of AREA_PLACES) {
    const s = L.stateFromPlace(p);
    assert.ok(s === "" || /^[a-z]{2}$/.test(s), p + " returned " + JSON.stringify(s));
  }
});

test("stateFromPlace: unknown, malformed, null and undefined ids return an empty string", () => {
  for (const bad of ["", "nope", "city:nowhere", "area:", null, undefined, 5, {}]) {
    assert.equal(L.stateFromPlace(bad), "", "input " + String(bad));
  }
});

/* ---------- hubsOf and hubsOfPlace ---------- */

test("hubsOf: an entry's regions map to hub ids, and no region gives an empty array", () => {
  assert.deepEqual(L.hubsOf({ regions: ["statewide"] }), ["state"]);
  assert.deepEqual(L.hubsOf({ regions: ["no-such-region"] }), []);
  assert.deepEqual(L.hubsOf({ regions: [] }), []);
  assert.deepEqual(L.hubsOf({}), []);
});

test("hubsOf and hubsOfPlace: every returned id exists in HUBS", () => {
  const hubIds = new Set(L.HUBS.map((h) => h[0]));
  for (const p of ALL_PLACES) {
    const out = L.hubsOfPlace(p);
    assert.ok(Array.isArray(out), "hubsOfPlace " + p + " is not an array");
    for (const h of out) assert.ok(hubIds.has(h), p + " returned unknown hub " + h);
  }
  for (const e of ENTRIES) {
    const out = L.hubsOf(e);
    assert.ok(Array.isArray(out), "hubsOf " + e.id + " is not an array");
    for (const h of out) assert.ok(hubIds.has(h), e.id + " returned unknown hub " + h);
  }
});

test("hubsOfPlace: unknown, null and undefined ids return an empty array", () => {
  for (const bad of ["", "nope", "city:nowhere", null, undefined]) {
    assert.deepEqual(L.hubsOfPlace(bad), [], "input " + String(bad));
  }
});
