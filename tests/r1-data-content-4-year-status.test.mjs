import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r1-data-content-4: four cards whose deadline text a teen could not act on.
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const program = (id) => JSON.parse(read("data/programs/" + id + ".json"));
const ENTRIES = JSON.parse(read("data/entries.json"));
const entry = (id) => ENTRIES.find((e) => e.id === id);

test("Cincinnati camp gives the FAQ grade range and an email to confirm the year", () => {
  const id = "cincinnati-uc-early-it-summer-camp";
  const card = program(id);
  assert.equal(card.grades, "9 to 12");
  assert.match(card.who_can_apply, /rising 9th graders through rising 12th graders/i);
  assert.match(card.deadline_text, /no year/);
  assert.match(card.deadline_text, /ucearlyit@ucmail\.uc\.edu/);
  assert.equal(entry(id).grades, "9 to 12");
  assert.equal(card.verified_on, "2026-10-10");
});

test("Pomona card softens the high school status and gives no invented phone", () => {
  const id = "pomona-valley-hospital-high-school-volunteer";
  const card = program(id);
  assert.equal(card.grades, "9 to 11");
  assert.match(card.deadline_text, /only accepting adult applications/);
  assert.match(card.deadline_text, /high school applications may be closed/);
  assert.equal(card.status, "unconfirmed");
  assert.doesNotMatch(card.how_to_apply, /call the hospital/);
  assert.equal(card.verified_on, "2026-10-10");
});

test("Westerville card gives no year and tells the teen to call the number on the page", () => {
  const id = "columbus-westerville-library-teen-volunteers";
  const card = program(id);
  assert.match(card.deadline_text, /no year/);
  assert.match(card.deadline_text, /614-882-7277, option 5/);
  assert.equal(card.verified_on, "2026-10-10");
});

test("Sacramento card names the 2025 session dates and asks for an email for the next session", () => {
  const id = "sac-north-natomas-wdp";
  const card = program(id);
  assert.match(card.deadline_text, /Fall\/Winter 2025/);
  assert.match(card.deadline_text, /October 8 to November 13, 2025/);
  assert.match(card.deadline_text, /NNworkforce@cityofsacramento\.org/);
  assert.equal(card.verified_on, "2026-10-10");
});
