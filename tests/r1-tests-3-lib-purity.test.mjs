// Run with: node --test tests/r1-tests-3-lib-purity.test.mjs
// lib.js is shared by several widgets on one page, so none of its functions may write to the entries
// they are given. This deep-freezes data/entries.json (strict mode, so a write throws), calls every
// entry-taking export with a few filter states and a fixed "now", and checks the data is byte-for-byte unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date(2026, 9, 10).getTime(); // Oct 10, 2026, fixed so the result never depends on the clock

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.getOwnPropertyNames(value).forEach((k) => deepFreeze(value[k], seen));
  return Object.freeze(value);
}

const entries = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "entries.json"), "utf8"));
assert.ok(Array.isArray(entries) && entries.length > 0, "data/entries.json loads as a non-empty array");
const before = JSON.stringify(entries);
deepFreeze(entries);
assert.ok(Object.isFrozen(entries) && Object.isFrozen(entries[0]), "the array and entries are frozen");

// A few filter states, from none to several filters on, so each facet code path runs on the frozen data.
const states = [
  {},
  { q: "youth paid", hubs: [], age: "", when: "", season: "", paid: [], types: [], fields: [], verified: false, noPermit: false },
  { q: "", hubs: ["sv"], age: "15", when: "open", season: "summer", paid: ["pay"], types: [], fields: [], verified: true, noPermit: true },
  { q: "", hubs: ["davis"], age: "", when: "60", season: "", paid: ["free"], types: [], fields: [], verified: false, noPermit: false, place: "city:davis", placeOnline: true },
  { q: "", hubs: [], age: "17", when: "closed", season: "", paid: ["fee", "unknown"], types: [], fields: [], verified: false, noPermit: false, place: "area:east-bay" },
];
const profile = { age: 15 };
const sample = entries.slice(0, 60).concat(entries.slice(-20));

// Runs fn twice on the frozen input. Each call must not throw, and both results must deep-equal each other.
function checkCall(label, fn) {
  let first, second;
  assert.doesNotThrow(() => { first = fn(); }, label + " does not throw");
  assert.doesNotThrow(() => { second = fn(); }, label + " does not throw on the second call");
  assert.deepEqual(second, first, label + " is deterministic");
  return first;
}

test("matches, relaxOptions and facetCounts run on frozen entries with several filter states", () => {
  states.forEach((st, i) => {
    sample.forEach((e) => checkCall("matches state " + i, () => L.matches(e, st, NOW)));
    checkCall("facetCounts state " + i, () => L.facetCounts(entries, st, NOW));
    checkCall("relaxOptions state " + i, () => L.relaxOptions(entries, st, NOW));
  });
});

test("rank, compare, sortList and topPicks run on frozen entries and do not reorder the shared array", () => {
  sample.forEach((e) => checkCall("rank " + e.id, () => L.rank(e, NOW, profile)));
  sample.slice(0, 20).forEach((e, i) => {
    const other = sample[i + 1];
    checkCall("compare " + e.id, () => L.compare(e, other, NOW, profile));
  });
  ["best", "deadline", "name"].forEach((mode) => {
    const out = checkCall("sortList " + mode, () => L.sortList(entries, mode, NOW, profile));
    assert.notEqual(out, entries, "sortList returns a new array for " + mode);
  });
  checkCall("topPicks", () => L.topPicks(entries, profile, NOW, 3));
  checkCall("topPicks without profile", () => L.topPicks(entries, {}, NOW, 5));
});

test("placeCounts, insights and the ICS calendar builder run on frozen entries", () => {
  checkCall("placeCounts", () => L.placeCounts(entries));
  checkCall("insights", () => L.insights(entries, NOW));
  checkCall("insights on a subset", () => L.insights(sample, NOW));
  // icsEvent takes a plain event object, so the calendar builder is fed fields read from a frozen entry.
  const stamp = new Date(Date.UTC(2026, 9, 10, 12, 0, 0));
  sample.slice(0, 15).forEach((e) => {
    const iso = e.deadline_iso || "2026-11-01";
    checkCall("icsEvent " + e.id, () => L.icsEvent({ dateISO: iso, uid: e.id, title: e.name, desc: e.what_you_do, stamp }));
  });
});

test("effStatus, futureDeadline, knownDeadline, ageOk and ageText run on frozen entries", () => {
  entries.forEach((e) => {
    checkCall("effStatus " + e.id, () => L.effStatus(e, NOW));
    checkCall("futureDeadline " + e.id, () => L.futureDeadline(e, NOW));
    checkCall("knownDeadline " + e.id, () => L.knownDeadline(e, NOW));
  });
  sample.forEach((e) => {
    checkCall("ageOk 15 " + e.id, () => L.ageOk(e, 15));
    checkCall("ageOk 17 " + e.id, () => L.ageOk(e, 17));
    checkCall("ageText " + e.id, () => L.ageText(e));
  });
});

test("the shared entries are byte-for-byte unchanged after every call", () => {
  assert.equal(JSON.stringify(entries), before, "JSON of the entries matches the copy taken before any call");
});
