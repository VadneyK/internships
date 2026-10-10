// Cross-file checks: place, state and permit ids must agree across lib.js and the data files,
// and every state and kind must give a usable permit answer. Run with: node --test tests/r2-tests-6.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
globalThis.self = globalThis;
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const read = (f) => JSON.parse(fs.readFileSync(new URL("../data/" + f, import.meta.url), "utf8"));
const PM = read("permits.json");
const YO = read("younger.json");
const MO = read("money.json");
const TR = read("transit.json");
const LA = read("languages.json");
const ENTRIES = read("entries.json");

const ONLINE_ONLY = ["virtual", "national"];
const KIND_IDS = PM.kinds.map((k) => k[0]);
const VERDICTS = ["need", "none", "ask", "young", "adult"];
const STATE_NAMES = new Set(Object.values(PM.states).map((s) => s.name));
const nonEmptyString = (x) => typeof x === "string" && x.trim() !== "";
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

test("REGIONS ids are unique", () => {
  const ids = L.REGIONS.map((r) => r[0]);
  assert.equal(new Set(ids).size, ids.length, "duplicate region id");
});

test("CITIES and AREAS ids are unique", () => {
  const cities = L.CITIES.map((c) => c[0]);
  const areas = L.AREAS.map((a) => a[0]);
  assert.equal(new Set(cities).size, cities.length, "duplicate city id");
  assert.equal(new Set(areas).size, areas.length, "duplicate area id");
});

test("every region except online and national has a state, a hub and a city", () => {
  const hubRegions = new Set(L.HUBS.flatMap((h) => h[2]));
  const cityRegions = new Set(L.CITIES.flatMap((c) => c[2]));
  for (const [id] of L.REGIONS) {
    if (ONLINE_ONLY.includes(id)) continue;
    assert.ok(hasOwn(L.STATE_OF, id), "STATE_OF has no key for " + id);
    assert.notEqual(L.STATE_OF[id], "", "STATE_OF is empty for " + id);
    assert.ok(hubRegions.has(id), "no hub lists region " + id);
    assert.ok(cityRegions.has(id), "no city lists region " + id);
  }
});

test("every member of CITIES and HUBS is a region id, and every AREAS member is a city id", () => {
  const regionIds = new Set(L.REGIONS.map((r) => r[0]));
  const cityIds = new Set(L.CITIES.map((c) => c[0]));
  for (const [id, , members] of L.CITIES) for (const r of members) assert.ok(regionIds.has(r), "city " + id + " has unknown region " + r);
  for (const [id, , members] of L.HUBS) for (const r of members) assert.ok(regionIds.has(r), "hub " + id + " has unknown region " + r);
  for (const [id, , members] of L.AREAS) for (const c of members) assert.ok(cityIds.has(c), "area " + id + " has unknown city " + c);
});

test("every city and every area has at least one program in entries.json", () => {
  const now = Date.now();
  for (const [id] of L.CITIES) {
    const place = "city:" + id;
    assert.ok(L.placeRegions(place), "placeRegions does not know " + place);
    assert.ok(ENTRIES.some((e) => L.matches(e, { place }, now)), "no program for city " + id);
  }
  for (const [id] of L.AREAS) {
    const place = "area:" + id;
    assert.ok(L.placeRegions(place), "placeRegions does not know " + place);
    assert.ok(ENTRIES.some((e) => L.matches(e, { place }, now)), "no program for area " + id);
  }
});

test("every non-empty STATE_OF value is a permit state, and PERMIT_STATES has no duplicates", () => {
  assert.equal(new Set(L.PERMIT_STATES).size, L.PERMIT_STATES.length, "duplicate in PERMIT_STATES");
  for (const v of new Set(Object.values(L.STATE_OF).filter(Boolean))) {
    assert.ok(L.PERMIT_STATES.includes(v), "STATE_OF uses " + v + ", which is not in PERMIT_STATES");
  }
});

test("permits.json states match PERMIT_STATES exactly", () => {
  assert.deepEqual(Object.keys(PM.states).sort(), [...L.PERMIT_STATES].sort());
});

test("every permits kind exists in every state, and every state has the core fields", () => {
  for (const [id, s] of Object.entries(PM.states)) {
    for (const kind of KIND_IDS) assert.ok(s.kinds && hasOwn(s.kinds, kind), id + " is missing kind " + kind);
    assert.ok(nonEmptyString(s.name), id + " has no name");
    assert.ok(nonEmptyString(s.permit), id + " has no permit name");
    assert.equal(typeof s.needBelow, "number", id + " needBelow is not a number");
    assert.equal(typeof (s.minAge && s.minAge.job), "number", id + " minAge.job is not a number");
    assert.ok(s.hours && typeof s.hours === "object", id + " has no hours");
    assert.ok(nonEmptyString(s.wage), id + " has no wage text");
    assert.ok(nonEmptyString(s.adult), id + " has no adult text");
  }
});

test("every non-null limits band has a numeric or null schoolDay and nonSchoolDay", () => {
  for (const [id, s] of Object.entries(PM.states)) {
    for (const [band, lim] of Object.entries(s.limits || {})) {
      if (lim === null) continue;
      for (const k of ["schoolDay", "nonSchoolDay"]) {
        assert.ok(lim[k] === null || typeof lim[k] === "number", id + " band " + band + " " + k + " must be a number or null (null means the page states no daily limit)");
      }
    }
  }
});

test("younger.json state ids are permit states and their names match", () => {
  for (const [id, name] of YO.states) {
    assert.ok(hasOwn(PM.states, id), "younger.json has unknown state " + id);
    assert.equal(name, PM.states[id].name, "younger.json name for " + id);
  }
});

test("money presets use known states, numeric wages and known extra items", () => {
  const ids = MO.presets.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate preset id");
  for (const p of MO.presets) {
    assert.ok(hasOwn(PM.states, p.state), "preset " + p.id + " has unknown state " + p.state);
    assert.ok(typeof p.wage === "number" && Number.isFinite(p.wage), "preset " + p.id + " wage is not a number");
    for (const item of p.extra || []) assert.ok(hasOwn(MO.rates, item), "preset " + p.id + " extra " + item + " has no rate");
  }
});

test("transit place states and languages rows states are 'All states' or a permit state name", () => {
  for (const p of TR.places) {
    assert.ok(p.state === "All states" || STATE_NAMES.has(p.state), "transit " + p.id + " has unknown state " + p.state);
  }
  for (const r of LA.rows) {
    assert.ok(r.state === "All states" || STATE_NAMES.has(r.state), "languages row " + r.title + " has unknown state " + r.state);
  }
});

test("permitFor gives a verdict, headline and text for every state, age 12 to 18 and kind", () => {
  const seen = new Set();
  for (const st of Object.keys(PM.states)) {
    for (let age = 12; age <= 18; age++) {
      for (const kind of KIND_IDS) {
        const where = [st, age, kind].join("/");
        const r = L.permitFor(PM, st, age, kind);
        assert.ok(r && typeof r === "object", where + " returned no answer");
        assert.ok(VERDICTS.includes(r.verdict), where + " has verdict " + r.verdict);
        seen.add(r.verdict);
        for (const field of ["headline", "text"]) {
          assert.ok(nonEmptyString(r[field]), where + " has empty " + field);
          for (const bad of ["undefined", "NaN", "null"]) {
            assert.ok(!r[field].includes(bad), where + " " + field + " contains " + bad);
          }
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(), [...VERDICTS].sort(), "not every verdict is reached");
});

test("hoursCheck runs on a 24 hour, 7 day week for every state at ages 14 to 17 without undefined or NaN", () => {
  const week = Array.from({ length: 7 }, () => ({ from: 0, to: 24 }));
  for (const [st, s] of Object.entries(PM.states)) {
    for (let age = 14; age <= 17; age++) {
      const where = st + "/" + age;
      const r = L.hoursCheck(s.limits, age, true, week);
      assert.equal(typeof r.total, "number", where + " total");
      for (const problem of r.problems) {
        assert.equal(typeof problem, "string", where + " problem is not text");
        assert.ok(!/undefined|NaN/.test(problem), where + " problem text: " + problem);
      }
    }
  }
});
