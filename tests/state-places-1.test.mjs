// "All of <State>" covers every program in that state (2026-10-15: "All of California" had shown 36 of 551,
// because a state place covered only its state-level region). Elgin says it shows the Chicago area. Texas shows once.
// Run with: node --test tests/state-places-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const E = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

test("every state place covers all regions in that state, so its count is every program there", () => {
  for (const [id, , own] of L.STATES) {
    const code = L.STATE_OF[own];
    const regs = Object.keys(L.STATE_OF).filter((r) => L.STATE_OF[r] === code);
    const pr = L.placeRegions("state:" + id);
    assert.equal(pr[0], own, id + " keeps its own region first");
    for (const r of regs) assert.ok(pr.includes(r), id + " covers " + r);
    const all = E.filter((e) => (e.regions || []).some((r) => regs.includes(r))).length;
    const got = E.filter((e) => L.matches(e, { place: "state:" + id }, Date.now())).length;
    assert.equal(got, all, id);
  }
  const ca = E.filter((e) => L.matches(e, { place: "state:california" }, Date.now())).length;
  assert.ok(ca > 500, "All of California shows every California program, got " + ca);
});

test("a whole-state place still names one state", () => {
  for (const [id] of L.STATES) assert.ok(L.stateFromPlace("state:" + id), id);
});

test("Elgin says it shows Chicago area programs, and Texas has one All of Texas choice", () => {
  assert.equal(L.CITIES.find((c) => c[0] === "elgin")[1], "Elgin and Chicago area programs");
  const tx = L.PICK_GROUPS.find((g) => g[0] === "Texas");
  assert.deepEqual(tx[1], [], "no Texas area next to the Texas state choice");
  assert.ok(tx[3].includes("texas"));
});
