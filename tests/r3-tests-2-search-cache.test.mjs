// Search text cache must follow edits to a card made in place.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const NOW = new Date(2026, 9, 10).getTime();
const LIB = require.resolve("../assets/js/lib.js");

function freshLib(noWeakMap) {
  delete require.cache[LIB];
  const WM = globalThis.WeakMap;
  if (noWeakMap) globalThis.WeakMap = undefined;
  try { return require("../assets/js/lib.js"); } finally { globalThis.WeakMap = WM; }
}
const L = freshLib(false);
const card = () => ({
  id: "x", name: "Alpha Program", org: "Org", regions: ["oakland"], city: "Oakland, CA", type: "paid-youth-program",
  fields: ["health"], what_you_do: "Sort books", notes: "aaaa bbbb", who_can_apply: "teens", min_age: 16, max_age: 19,
  paid_type: "paid", season: "summer", status: "rolling", verified: "fetched", priority: 1, needs_work_permit: true
});
const m = (e, q) => L.matches(e, { q }, NOW);

test("same-length notes edit changes results at once", () => {
  const e = card();
  assert.equal(m(e, "aaaa"), true);
  e.notes = "cccc dddd";
  e.notes = "xxxx yyyy";
  assert.equal(m(e, "aaaa"), false);
  assert.equal(m(e, "xxxx"), true);
});
test("name edit changes results", () => {
  const e = card();
  assert.equal(m(e, "alpha"), true);
  e.name = "Omega Program";
  assert.equal(m(e, "alpha"), false);
  assert.equal(m(e, "omega"), true);
});
test("what_you_do edit changes results", () => {
  const e = card();
  assert.equal(m(e, "sort"), true);
  e.what_you_do = "Fold maps";
  assert.equal(m(e, "sort"), false);
  assert.equal(m(e, "fold"), true);
});
test("regions edit changes results", () => {
  const e = card();
  assert.equal(m(e, "oakland"), true);
  assert.equal(m(e, "berkeley"), false);
  e.city = "Elsewhere";
  e.regions = ["berkeley"];
  assert.equal(m(e, "oakland"), false);
  assert.equal(m(e, "berkeley"), true);
  e.regions.push("san-jose");
  assert.equal(m(e, "jose"), true);
});
test("alternating queries A, B, A stay correct", () => {
  const e = card();
  for (const [q, want] of [["alpha", true], ["zzzz", false], ["alpha", true], ["zzzz", false], ["sort books", true]]) assert.equal(m(e, q), want, q);
});
test("punctuation and extra spaces match like the trimmed form", () => {
  const e = card();
  assert.equal(m(e, "  alpha   program  "), m(e, "alpha program"));
  assert.equal(m(e, "  zzzz  "), m(e, "zzzz"));
  assert.equal(m(e, "!!!"), m(e, ""));
  assert.equal(m(e, " ?? , "), true);
  assert.equal(m(e, "alpha !!"), m(e, "alpha"));
});
test("cached and uncached paths agree on every real card", () => {
  const raw = JSON.parse(fs.readFileSync(new URL("../data/entries-lite.json", import.meta.url), "utf8"));
  const list = Array.isArray(raw) ? raw : raw.entries || raw.programs || Object.values(raw);
  assert.ok(list.length > 100);
  const U = freshLib(true);
  const qs = ["paid", "unpaid", "library", "oakland", "tutor", "camp", "science", "art", "health", "city", "park", "teen", "volunteer", "summer", "coding", "food", "animals", "museum", "!!", "  school  "];
  for (const q of qs) {
    const a = list.filter((e) => L.matches(e, { q }, NOW)).map((e) => e.id);
    const b = list.filter((e) => U.matches(e, { q }, NOW)).map((e) => e.id);
    assert.deepEqual(a, b, q);
  }
});
