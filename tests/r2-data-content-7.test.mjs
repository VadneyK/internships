import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-data-content-7. Eight cards gave a month and day but no year.
// A card may be open-now or opens-soon only when the page states the year or an exact window.
const IDS = [
  "nyc-bbg-garden-apprentice-program",
  "champaign-carle-foundation-hospital-student-volunteers",
  "christ-hospital-junior-ambassador-program",
  "montgomery-county-teenworks-employment-program",
  "seattle-childrens-hospital-volunteer",
  "santa-clara-county-teen-cert",
  "atlanta-parks-rec-teen-leaders",
  "nyc-mount-sinai-morningside-jump-teen-volunteer",
];
const TODAY = "2026-10-09";
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const ENTRIES = read("../data/entries.json");
const entryList = Array.isArray(ENTRIES) ? ENTRIES : ENTRIES.entries || ENTRIES.programs;

for (const id of IDS) {
  test(`${id}: still exists in the program file and in entries.json`, () => {
    const card = read(`../data/programs/${id}.json`);
    assert.equal(card.id, id);
    assert.ok(entryList.some((e) => e.id === id));
  });

  test(`${id}: open-now or opens-soon needs a current confirmed date`, () => {
    const card = read(`../data/programs/${id}.json`);
    if (card.status !== "open-now" && card.status !== "opens-soon") return;
    assert.equal(card.deadline_confidence, "confirmed-2026-27");
    const iso = card.deadline_iso || card.opens_iso;
    assert.ok(iso && iso >= TODAY, `${id} date ${iso} is before ${TODAY}`);
  });
}

test("atlanta-parks-rec-teen-leaders: unconfirmed, no deadline_iso, because the catalog does not say which summer the Dec 31, 2026 cutoff is for", () => {
  const card = read("../data/programs/atlanta-parks-rec-teen-leaders.json");
  assert.equal(card.status, "unconfirmed");
  assert.equal(card.deadline_confidence, "unknown");
  assert.equal(card.deadline_iso, null);
});

test("cards whose page prints no year are not given a made-up date", () => {
  for (const id of IDS.filter((i) => i !== "atlanta-parks-rec-teen-leaders")) {
    const card = read(`../data/programs/${id}.json`);
    assert.equal(card.deadline_iso, null, id);
  }
});
