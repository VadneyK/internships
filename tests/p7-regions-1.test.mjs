// The 11 states added in ticket p7-regions-1: each has programs, a whole-state Where choice, a label and one picker group.
// Run with: node --test tests/p7-regions-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
globalThis.self = globalThis;
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

const NEW = {
  arizona: "Arizona", nevada: "Nevada", colorado: "Colorado", utah: "Utah", florida: "Florida", hawaii: "Hawaii",
  oregon: "Oregon", tennessee: "Tennessee", kentucky: "Kentucky", missouri: "Missouri", "new-mexico": "New Mexico"
};
const ids = Object.keys(NEW);

test("each new state has at least 3 programs", () => {
  for (const id of ids) {
    const n = ENTRIES.filter((e) => (e.regions || []).includes(id)).length;
    assert.ok(n >= 3, id + " has only " + n + " programs");
  }
});

test("each new state is a region with a label and a state code", () => {
  for (const id of ids) {
    assert.equal(L.regionLabel(id), NEW[id], "label for " + id);
    assert.ok(L.STATE_OF[id], "STATE_OF for " + id);
  }
});

test("each whole-state place returns programs and has a label", () => {
  const now = Date.now();
  for (const id of ids) {
    const place = "state:" + id;
    assert.deepEqual(L.placeRegions(place), [id], "placeRegions " + place);
    assert.equal(L.placeLabel(place), NEW[id], "placeLabel " + place);
    assert.ok(ENTRIES.some((e) => L.matches(e, { place }, now)), "no program for " + place);
  }
});

test("each new state is in exactly one picker group", () => {
  for (const id of ids) {
    const groups = L.PICK_GROUPS.filter((g) => (g[3] || []).includes(id));
    assert.equal(groups.length, 1, id + " is in " + groups.length + " groups");
  }
});
