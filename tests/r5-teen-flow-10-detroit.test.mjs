// Ticket r5-detroit-1: a teen in Detroit could not pick Detroit in the Where picker.
// Detroit is now a city choice that covers the Michigan region.
// Run with: node --test tests/r5-teen-flow-10-detroit.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

test("the detroit city has its label and covers the michigan region", () => {
  const entry = L.CITIES.find((c) => c[0] === "detroit");
  assert.ok(entry, "CITIES must have the id detroit");
  assert.equal(entry[1], "Detroit (no Detroit-only listings yet, showing Michigan)");
  assert.deepEqual(entry[2], ["michigan"]);
});

test("placeLabel(\"city:detroit\") says there are no Detroit-only listings", () => {
  assert.equal(L.placeLabel("city:detroit"), "Detroit (no Detroit-only listings yet, showing Michigan)");
});

test("placeRegions(\"city:detroit\") returns the michigan region", () => {
  assert.deepEqual(L.placeRegions("city:detroit"), ["michigan"]);
});

test("PICK_GROUPS puts detroit once, in the Midwest group", () => {
  const groups = L.PICK_GROUPS.filter((g) => g[2].includes("detroit"));
  assert.equal(groups.length, 1, "detroit must be in exactly one PICK_GROUPS group");
  assert.equal(groups[0][0], "Midwest");
  assert.equal(groups[0][2].filter((c) => c === "detroit").length, 1, "detroit listed twice in Midwest");
});

test("selecting detroit returns Michigan programs and only Michigan programs", () => {
  const now = Date.now();
  const picked = ENTRIES.filter((e) => L.matches(e, { place: "city:detroit" }, now));
  const michigan = ENTRIES.filter((e) => (e.regions || []).includes("michigan"));
  assert.ok(picked.length > 0, "no programs for detroit");
  assert.equal(picked.length, michigan.length, "detroit should return every Michigan program");
  assert.deepEqual(picked.map((e) => e.id).sort(), michigan.map((e) => e.id).sort());
  for (const e of picked) assert.ok((e.regions || []).includes("michigan"), e.id + " is not a Michigan program");
});

test("a Detroit program is in the detroit results", () => {
  const now = Date.now();
  const detroitProgram = ENTRIES.find((e) => e.id === "michigan-detroit-zoo-zoo-corps");
  assert.ok(detroitProgram, "expected the Detroit Zoo program in entries.json");
  assert.ok(L.matches(detroitProgram, { place: "city:detroit" }, now));
});
