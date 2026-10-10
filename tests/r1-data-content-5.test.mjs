import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// UCSF ImmunoExplore card: the page still says "2026 camper applications are open" under a
// "Summer Camp 2025" title with no dates, so the card must say the page is out of date and
// must not claim a confirmed deadline.

const ID = "sf-ucsf-immunoexplore";
const card = JSON.parse(fs.readFileSync(new URL(`../data/programs/${ID}.json`, import.meta.url), "utf8"));
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

test(`${ID}: status is unconfirmed, not closed-expect-reopen`, () => {
  assert.equal(card.status, "unconfirmed");
});

test(`${ID}: no deadline or confirmed date is invented`, () => {
  assert.equal(card.deadline_iso, null);
  assert.equal(card.deadline_confidence, "unknown");
  assert.equal(card.opens_iso, null);
  assert.equal(card.grades, null);
  assert.equal(card.min_age, null);
  assert.equal(card.max_age, null);
});

test(`${ID}: deadline_text says the page is out of date and to email before applying`, () => {
  assert.match(card.deadline_text, /out of date/);
  assert.match(card.deadline_text, /Summer Camp 2025/);
  assert.match(card.deadline_text, /email the program through the Contact Us link/);
});

test(`${ID}: how_to_apply tells teens to email before using the Google Form`, () => {
  assert.match(card.how_to_apply, /^Email the program first/);
  assert.match(card.how_to_apply, /Google Form/);
});

test(`${ID}: verified_on is the day the official page was read`, () => {
  assert.equal(card.verified, "fetched");
  assert.equal(card.verified_on, "2026-10-09");
});

test(`${ID}: generated entries.json matches the program file status and dates`, () => {
  const entry = ENTRIES.find((e) => e.id === ID);
  assert.ok(entry, "entry exists");
  assert.equal(entry.status, card.status);
  assert.equal(entry.deadline_confidence, card.deadline_confidence);
  assert.equal(entry.deadline_text, card.deadline_text);
  assert.equal(entry.verified_on, card.verified_on);
});

test(`${ID}: no em dash or en dash in any text field`, () => {
  const text = JSON.stringify(card);
  assert.doesNotMatch(text, /[\u2013\u2014]/);
});
