// Property tests for the age filter over every real card in data/entries.json.
// Run with: node --test tests/r1-tests-5-age-filter-real-cards.test.mjs
// Uses L.matches (the Find page filter, with state.age) and L.ageOk (used by Find and Jobs lists).
// Failures print the offending card id. Files are read from disk, so no clock or network is used.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARDS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "entries.json"), "utf8"));
const NOW = new Date("2026-10-10T12:00:00");
const AGES = [12, 13, 14, 15, 16, 17, 18];
const byAge = (fn) => Object.fromEntries(AGES.map((a) => [a, fn(a)]));
const viaMatches = (a) => CARDS.filter((e) => L.matches(e, { age: a }, NOW));
const viaAgeOk = (a) => CARDS.filter((e) => L.ageOk(e, a));

test("real data has the cards the property tests need", () => {
  assert.ok(CARDS.length > 1000, "entries.json should hold the full card list");
  assert.ok(CARDS.some((e) => e.min_age == null && e.max_age == null), "need cards with no ages");
  assert.ok(CARDS.some((e) => e.min_age != null && e.max_age == null), "need cards with only a min_age");
});

[["L.matches with state.age", viaMatches], ["L.ageOk", viaAgeOk]].forEach(([label, pick]) => {
  test(`${label}: never returns a card outside its stated ages, always returns a card with no ages`, () => {
    AGES.forEach((age) => {
      const ids = new Set(pick(age).map((e) => e.id));
      CARDS.forEach((e) => {
        const got = ids.has(e.id);
        if (typeof e.min_age === "number" && e.min_age > age) assert.equal(got, false, `card ${e.id} (min_age ${e.min_age}) shown to age ${age}`);
        if (typeof e.max_age === "number" && e.max_age < age) assert.equal(got, false, `card ${e.id} (max_age ${e.max_age}) shown to age ${age}`);
        if (e.min_age == null && e.max_age == null) assert.equal(got, true, `card ${e.id} (no ages) missing for age ${age}`);
        if ((e.min_age == null || e.min_age <= age) && (e.max_age == null || e.max_age >= age)) assert.equal(got, true, `card ${e.id} fits age ${age} but is missing`);
      });
    });
  });

  test(`${label}: no card is returned twice`, () => {
    AGES.forEach((age) => {
      const seen = new Set();
      pick(age).forEach((e) => {
        assert.equal(seen.has(e.id), false, `card ${e.id} returned twice for age ${age}`);
        seen.add(e.id);
      });
    });
  });

  test(`${label}: count of min_age-only cards never drops from age 12 to 18`, () => {
    const minOnly = new Set(CARDS.filter((e) => e.min_age != null && e.max_age == null).map((e) => e.id));
    let prev = null, prevAge = null, prevIds = null;
    AGES.forEach((age) => {
      const ids = new Set(pick(age).filter((e) => minOnly.has(e.id)).map((e) => e.id));
      if (prev !== null) {
        const lost = [...prevIds].filter((id) => !ids.has(id));
        assert.equal(lost.length, 0, `card ${lost[0]} shown at age ${prevAge} but gone at age ${age}`);
        assert.ok(ids.size >= prev, `count fell from ${prev} to ${ids.size} between ages ${prevAge} and ${age}`);
      }
      prev = ids.size; prevAge = age; prevIds = ids;
    });
  });
});

test("L.matches with an age agrees with L.ageOk for every card and age", () => {
  const m = byAge((a) => viaMatches(a).map((e) => e.id).join("|"));
  const o = byAge((a) => viaAgeOk(a).map((e) => e.id).join("|"));
  AGES.forEach((a) => assert.equal(m[a], o[a], `matches and ageOk disagree at age ${a}`));
});
