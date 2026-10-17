import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-data-content-7 (re-read of opens-soon cards). Three cards were re-read
// on 2026-10-10: WakeMed junior volunteering, Rockefeller SSRP and MIT WTP-ME.
// (tests/r2-data-content-7.test.mjs is a different ticket and is left alone.)
const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const ENTRIES = read("../data/entries.json");
const entryList = Array.isArray(ENTRIES) ? ENTRIES : ENTRIES.entries || ENTRIES.programs;
const DASHES = /[\u2013\u2014]/;

const CARDS = {
  "wakemed-junior-volunteer-program": { opens_iso: null, deadline_iso: null, status: "closed-expect-reopen", text: ["24 to 48 hours", "Dec 15, 2026"] }, // 2026-10-16: both campuses showed closed after the Oct 15 window; re-read.
  "nyc-rockefeller-summer-science-research-program": { opens_iso: null, deadline_iso: "2027-01-04", status: "open-now", text: ["January 4, 2027", "5:00 p.m."] }, // 2026-10-13: the page now posts the 2027 deadline (Jan 4, 2027, 5 pm ET); re-read.
  "boston-mit-womens-technology-program": { opens_iso: null, deadline_iso: "2026-12-21", status: "open-now", text: ["summer 2027", "Dec 21, 2026"] }, // 2026-10-16: applications opened Oct 16, 2026; re-read.
};

for (const [id, want] of Object.entries(CARDS)) {
  test(`${id}: status, dates and deadline_text match the re-read`, () => {
    const card = read(`../data/programs/${id}.json`);
    assert.equal(card.status, want.status || "opens-soon");
    assert.equal(card.opens_iso, want.opens_iso);
    assert.equal(card.deadline_iso, want.deadline_iso);
    for (const phrase of want.text) assert.ok(card.deadline_text.includes(phrase), `${id} missing "${phrase}"`);
    assert.doesNotMatch(card.deadline_text, DASHES);
  });

  test(`${id}: entries.json card matches the program file`, () => {
    const card = read(`../data/programs/${id}.json`);
    const entry = entryList.find((e) => e.id === id);
    assert.ok(entry, `${id} missing from entries.json`);
    assert.equal(entry.deadline_text, card.deadline_text);
    assert.equal(entry.opens_iso, card.opens_iso);
    assert.equal(entry.deadline_iso, card.deadline_iso ?? null);
    assert.equal(entry.status, card.status);
  });
}

test("SSRP: deadline_iso is 2027-01-04, because the page now posts the 2027 deadline", () => {
  const card = read("../data/programs/nyc-rockefeller-summer-science-research-program.json");
  // 2026-10-13: the page now posts the 2027 deadline (Jan 4, 2027, 5 pm ET); re-read.
  assert.equal(card.deadline_iso, "2027-01-04");
  assert.equal(card.deadline_confidence, "confirmed-2026-27");
});

test("MIT: the year appears only as summer 2027 for the program and Dec 21, 2026 for the deadline", () => {
  const card = read("../data/programs/boston-mit-womens-technology-program.json");
  assert.equal(card.deadline_iso, "2026-12-21");
  assert.match(card.deadline_text, /summer 2027/);
});
