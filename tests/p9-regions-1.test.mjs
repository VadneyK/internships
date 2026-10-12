// Ticket p9-regions-1: eight Plains and Mountain states in the Where picker, and single-state cards no longer tagged national.
// Run with: node --test tests/p9-regions-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
globalThis.self = globalThis;
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

const NEW = {
  nebraska: ["Nebraska", "ne"], kansas: ["Kansas", "ks"], iowa: ["Iowa", "ia"], "south-dakota": ["South Dakota", "sd"],
  "north-dakota": ["North Dakota", "nd"], montana: ["Montana", "mt"], wyoming: ["Wyoming", "wy"], idaho: ["Idaho", "id"]
};
const ids = Object.keys(NEW);

test("each new state has a label and a state code", () => {
  for (const id of ids) {
    assert.equal(L.regionLabel(id), NEW[id][0], "label for " + id);
    assert.equal(L.STATE_OF[id], NEW[id][1], "STATE_OF for " + id);
  }
});

test("each new state has a whole-state place with a label, in exactly one picker group", () => {
  for (const id of ids) {
    const place = "state:" + id;
    assert.deepEqual(L.placeRegions(place), [id], "placeRegions " + place);
    assert.equal(L.placeLabel(place), NEW[id][0], "placeLabel " + place);
    const groups = L.PICK_GROUPS.filter((g) => (g[3] || []).includes(id));
    assert.equal(groups.length, 1, id + " is in " + groups.length + " groups");
    assert.equal(groups[0][0], "Plains and Mountain");
  }
});

test("each new state place returns its own programs, or none yet so the page shows the nothing-listed card and online fallback", () => {
  const now = Date.now();
  const fallback = ENTRIES.filter((e) => (e.regions || []).some((r) => r === "national" || r === "virtual"));
  assert.ok(fallback.length > 0, "there must be online and national programs to fall back on");
  for (const id of ids) {
    const place = "state:" + id;
    const hits = ENTRIES.filter((e) => L.matches(e, { place }, now));
    // Zero is allowed. find.js then shows "We have no listings for this place yet" plus the online and national programs.
    assert.ok(hits.every((e) => (e.regions || []).includes(id)), place + " matches only cards in its own region");
  }
  for (const id of ["iowa", "montana", "idaho", "wyoming", "nevada"]) {
    assert.ok(ENTRIES.some((e) => L.matches(e, { place: "state:" + id }, now)), "no program for state:" + id);
  }
});

test("Iowa has its own cards and they are not tagged national", () => {
  const iowa = ENTRIES.filter((e) => (e.regions || []).includes("iowa"));
  assert.ok(iowa.length >= 7, "iowa cards: " + iowa.length);
  assert.ok(iowa.every((e) => !(e.regions || []).includes("national")));
});

test("retagged single-state cards no longer show for a teen in another state", () => {
  const now = Date.now();
  const place = "state:nebraska";
  const shown = new Set(ENTRIES.filter((e) => L.matches(e, { place }, now)).map((e) => e.id));
  for (const id of ["iowa-ffa-association", "genesys-works-bay-area", "hidden-genius-project-immersion", "deca-california"]) {
    assert.ok(!shown.has(id), id + " should not show for Nebraska");
  }
});
