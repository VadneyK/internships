// Run with: node --test tests/*.test.mjs
// Ticket r3-data-content-3: these seven cards list the places their own eligibility text names.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const REGION_IDS = L.REGIONS.map((r) => r[0]);
const entries = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const byId = new Map(entries.map((e) => [e.id, e]));
const programFile = (id) => JSON.parse(readFileSync(new URL("../data/programs/" + id + ".json", import.meta.url), "utf8"));

// The original regions (before this ticket) and the regions appended by it, in order.
const CARDS = {
  "champaign-uiuc-young-scholars-research": { original: ["champaign", "illinois"], added: ["indiana", "michigan", "wisconsin"] },
  "seattle-uw-changemakers-in-computing": { original: ["seattle"], added: ["washington"] },
  "pomona-college-academy-for-youth-success": { original: ["inland-empire", "los-angeles"], added: ["orange-county"] },
  "stanford-grips": { original: ["silicon-valley", "peninsula"], added: ["san-francisco", "east-bay"] },
  "lbnl-bldap": { original: ["berkeley", "oakland", "east-bay"], added: ["san-francisco"] },
  "rising-sun-climate-careers": { original: ["oakland", "east-bay"], added: ["san-francisco", "silicon-valley", "merced"] },
  "alameda-county-library-teen-volunteer": { original: ["silicon-valley", "fremont"], added: ["alameda"] },
};

// A card matches a city or area pick when it shares at least one region with it (same rule as matches() in lib.js).
const matchesPlace = (card, place) => {
  const pr = L.placeRegions(place) || [];
  return pr.some((r) => card.regions.indexOf(r) > -1);
};

for (const [id, spec] of Object.entries(CARDS)) {
  test(id + ": added regions are appended after the original ones, in order", () => {
    const e = byId.get(id);
    assert.ok(e, id + " is missing from data/entries.json");
    assert.deepEqual(e.regions, [...spec.original, ...spec.added]);
    assert.equal(e.regions[0], spec.original[0], "first region must not change");
  });

  test(id + ": the program file and the built entries agree", () => {
    const src = programFile(id);
    assert.deepEqual(src.regions, byId.get(id).regions);
  });

  test(id + ": every region is a known id in REGIONS and listed once", () => {
    const e = byId.get(id);
    for (const r of e.regions) assert.ok(REGION_IDS.includes(r), id + " has unknown region " + r);
    assert.equal(new Set(e.regions).size, e.regions.length, id + " repeats a region");
  });

  test(id + ": stateOf is the same before and after", () => {
    const e = byId.get(id);
    assert.equal(L.stateOf(e), L.stateOf({ ...e, regions: spec.original }));
  });
}

test("champaign-uiuc-young-scholars-research matches West Lafayette, East Lansing and Ann Arbor picks", () => {
  const card = byId.get("champaign-uiuc-young-scholars-research");
  assert.equal(matchesPlace(card, "city:west-lafayette"), true);
  assert.equal(matchesPlace(card, "city:east-lansing"), true);
  assert.equal(matchesPlace(card, "city:ann-arbor"), true);
  assert.equal(matchesPlace(card, "city:urbana-champaign"), true);
});

test("champaign card is inside the Midwest area pick", () => {
  const card = byId.get("champaign-uiuc-young-scholars-research");
  assert.equal(matchesPlace(card, "area:midwest"), true);
});

test("seattle card matches the Seattle and Pacific Northwest picks", () => {
  const card = byId.get("seattle-uw-changemakers-in-computing");
  assert.equal(matchesPlace(card, "city:seattle"), true);
  assert.equal(matchesPlace(card, "area:pacific-northwest"), true);
});

test("pomona card matches the Irvine and Orange County pick", () => {
  const card = byId.get("pomona-college-academy-for-youth-success");
  assert.equal(matchesPlace(card, "city:irvine"), true);
});

test("stanford-grips matches the San Francisco and Berkeley and East Bay picks", () => {
  const card = byId.get("stanford-grips");
  assert.equal(matchesPlace(card, "city:san-francisco"), true);
  assert.equal(matchesPlace(card, "city:berkeley"), true);
});

test("alameda county library card matches the Berkeley and East Bay pick", () => {
  const card = byId.get("alameda-county-library-teen-volunteer");
  assert.equal(matchesPlace(card, "city:berkeley"), true);
});

test("rising sun card matches the Merced and San Francisco picks", () => {
  const card = byId.get("rising-sun-climate-careers");
  assert.equal(matchesPlace(card, "city:merced"), true);
  assert.equal(matchesPlace(card, "city:san-francisco"), true);
});
