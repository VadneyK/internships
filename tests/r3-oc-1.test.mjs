// Ticket r3-oc-1: the Where picker city for Irvine also names Costa Mesa and Orange County.
// Run with: node --test tests/r3-oc-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const IRVINE_LABEL = "Irvine, Costa Mesa and Orange County";

test("the irvine city keeps its id and its regions, and its label names Costa Mesa", () => {
  const entry = L.CITIES.find((c) => c[0] === "irvine");
  assert.ok(entry, "CITIES must still have the id irvine");
  assert.equal(entry[1], IRVINE_LABEL);
  assert.match(entry[1], /Costa Mesa/);
  assert.deepEqual(entry[2], ["orange-county", "statewide"]);
});

test("placeLabel(\"city:irvine\") returns the label that names Costa Mesa", () => {
  const label = L.placeLabel("city:irvine");
  assert.equal(label, IRVINE_LABEL);
  assert.ok(label.includes("Costa Mesa"), "label should include Costa Mesa");
});

test("PICK_GROUPS lists every city exactly once", () => {
  const cityIds = L.CITIES.map((c) => c[0]);
  const listed = L.PICK_GROUPS.flatMap((g) => g[2]);
  assert.equal(new Set(listed).size, listed.length, "a city is listed in PICK_GROUPS more than once");
  assert.deepEqual([...listed].sort(), [...cityIds].sort(), "PICK_GROUPS must list exactly the CITIES ids");
});
