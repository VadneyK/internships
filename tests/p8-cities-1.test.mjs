// Ticket p8-cities-1: teens search for big cities in the 11 new states and found only whole-state choices.
// Each city below is a Where choice with its own label, covers its state's region, sits in one picker group
// next to its state, and returns the same programs as the whole-state choice.
// Run with: node --test tests/p8-cities-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
globalThis.self = globalThis;
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

// [city id, label, state id, state label]
const CITY_STATE = [
  ["portland", "Portland and Oregon programs", "oregon", "Oregon"],
  ["phoenix", "Phoenix and Arizona programs", "arizona", "Arizona"],
  ["las-vegas", "Las Vegas and Nevada programs", "nevada", "Nevada"],
  ["denver", "Denver and Colorado programs", "colorado", "Colorado"],
  ["salt-lake-city", "Salt Lake City and Utah programs", "utah", "Utah"],
  ["miami", "Miami and Florida programs", "florida", "Florida"],
  ["honolulu", "Honolulu and Hawaii programs", "hawaii", "Hawaii"],
  ["nashville", "Nashville and Tennessee programs", "tennessee", "Tennessee"],
  ["louisville", "Louisville and Kentucky programs", "kentucky", "Kentucky"],
  ["st-louis", "St. Louis and Missouri programs", "missouri", "Missouri"],
  ["albuquerque", "Albuquerque and New Mexico programs", "new-mexico", "New Mexico"]
];

test("each new big city is in CITIES with its label", () => {
  for (const [id, label] of CITY_STATE) {
    const entry = L.CITIES.find((c) => c[0] === id);
    assert.ok(entry, "CITIES must have the id " + id);
    assert.equal(entry[1], label, "label for " + id);
    assert.equal(L.placeLabel("city:" + id), label, "placeLabel for " + id);
  }
});

test("each new big city covers its state's region and nothing else", () => {
  for (const [id, , state] of CITY_STATE) {
    assert.deepEqual(L.placeRegions("city:" + id), [state], "placeRegions for " + id);
  }
});

test("each new big city is in exactly one PICK_GROUPS group, next to its state", () => {
  for (const [id, , state] of CITY_STATE) {
    const cityGroups = L.PICK_GROUPS.filter((g) => g[2].includes(id));
    assert.equal(cityGroups.length, 1, id + " must be in exactly one group");
    assert.equal(cityGroups[0][2].filter((c) => c === id).length, 1, id + " listed twice in its group");
    const stateGroups = L.PICK_GROUPS.filter((g) => (g[3] || []).includes(state));
    assert.equal(stateGroups.length, 1, state + " must be in exactly one group");
    assert.equal(cityGroups[0], stateGroups[0], id + " must sit in the same group as " + state);
  }
});

test("choosing each new big city returns the same programs as its whole state", () => {
  const now = Date.now();
  for (const [id, , state] of CITY_STATE) {
    const byCity = ENTRIES.filter((e) => L.matches(e, { place: "city:" + id }, now)).map((e) => e.id).sort();
    // 2026-10-15: a whole state now also covers city regions (Austin in Texas), so compare with the state-level region only.
    const own = L.STATES.find((x) => x[0] === state)[2];
    const byState = ENTRIES.filter((e) => (e.regions || []).includes(own)).map((e) => e.id).sort();
    assert.ok(byCity.length > 0, "no programs for " + id);
    assert.deepEqual(byCity, byState, id + " should return the same programs as " + state);
  }
});

test("the new big cities are counted in the place counts", () => {
  const counts = L.placeCounts(ENTRIES);
  for (const [id, , state] of CITY_STATE) {
    const own = L.STATES.find((x) => x[0] === state)[2]; // 2026-10-15: the state-level region, not the whole state
    assert.equal(counts["city:" + id], ENTRIES.filter((e) => (e.regions || []).includes(own)).length, id + " count should equal " + state);
  }
});
