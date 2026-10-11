// Run with: node --test tests/r1-tests-7-region-lookups.test.mjs
// Checks that every region code, place and state lookup in lib.js resolves for every card in data/entries.json.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const CARDS = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const PERMITS = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

// National tags: a card with only these regions is listed on purpose as online or national, not tied to a city or area.
const NATIONAL_TAGS = new Set(["virtual", "national"]);
const REGION_IDS = new Set(L.REGIONS.map((r) => r[0]));
const ALLOWED_STATES = new Set(["", ...L.PERMIT_STATES]);
const PLACES = [
  ...L.CITIES.map((c) => "city:" + c[0]),
  ...L.AREAS.map((a) => "area:" + a[0]),
];

test("every region code on a card exists in L.REGIONS and has a human label", () => {
  const unknown = [];
  const unlabeled = [];
  CARDS.forEach((c) => (c.regions || []).forEach((r) => {
    if (!REGION_IDS.has(r)) unknown.push(c.id + " / " + r);
    const label = L.regionLabel(r);
    if (!label || label === r) unlabeled.push(c.id + " / " + r);
  }));
  assert.deepEqual(unknown, [], "cards with a region code not in L.REGIONS: " + unknown.join(", "));
  assert.deepEqual(unlabeled, [], "cards whose region prints as a raw code: " + unlabeled.join(", "));
});

test("every card is reachable from a city or area, or uses only a national tag", () => {
  const unreachable = [];
  CARDS.forEach((c) => {
    const regions = c.regions || [];
    if (regions.length && regions.every((r) => NATIONAL_TAGS.has(r))) return;
    const reachable = PLACES.some((p) => {
      const rs = L.placeRegions(p) || [];
      return regions.some((r) => rs.indexOf(r) > -1);
    });
    if (!reachable) unreachable.push(c.id + " (" + regions.join(", ") + ")");
  });
  assert.deepEqual(unreachable, [], "cards no place picker can find: " + unreachable.join("; "));
});

test("every card's stateOf is a known state or empty", () => {
  const bad = [];
  CARDS.forEach((c) => {
    const s = L.stateOf(c);
    if (!ALLOWED_STATES.has(s)) bad.push(c.id + " -> " + JSON.stringify(s));
  });
  assert.deepEqual(bad, [], "cards with an unknown state: " + bad.join(", "));
});

test("every place resolves to a known state or empty", () => {
  const bad = [];
  PLACES.forEach((p) => {
    const s = L.stateFromPlace(p);
    if (!ALLOWED_STATES.has(s)) bad.push(p + " -> " + JSON.stringify(s));
  });
  assert.deepEqual(bad, [], "places with an unknown state: " + bad.join(", "));
});

test("every PERMIT_STATES key has a permitFor answer, and every STATE_OF value is a PERMIT_STATES key", () => {
  const noAnswer = [];
  L.PERMIT_STATES.forEach((st) => {
    const kinds = Object.keys(PERMITS.states[st] ? PERMITS.states[st].kinds : {});
    if (!kinds.length) noAnswer.push(st + " (no kinds in permits.json)");
    kinds.forEach((k) => {
      const a = L.permitFor(PERMITS, st, 16, k);
      if (!a || a.verdict === "nostate") noAnswer.push(st + "/" + k);
    });
  });
  assert.deepEqual(noAnswer, [], "PERMIT_STATES keys with no permitFor answer: " + noAnswer.join(", "));

  const notPermit = [];
  Object.keys(L.STATE_OF).forEach((region) => {
    const st = L.STATE_OF[region];
    if (st && L.PERMIT_STATES.indexOf(st) < 0) notPermit.push(region + " -> " + st);
  });
  assert.deepEqual(notPermit, [], "STATE_OF values that are not PERMIT_STATES keys: " + notPermit.join(", "));
});
