import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-data-content-3: two closed-expect-reopen cards must not tell a teen the page is open.

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const program = (id) => JSON.parse(read("data/programs/" + id + ".json"));
const ENTRIES = JSON.parse(read("data/entries.json"));

const CINCINNATI = "cincinnati-uc-early-it-summer-camp";
const GO4BRAINS = "twin-cities-umn-go4brains-neuroscience";

test("Cincinnati camp stays closed-expect-reopen and says the page shows no year", () => {
  const card = program(CINCINNATI);
  assert.equal(card.status, "closed-expect-reopen");
  assert.match(card.deadline_text, /no year/);
  assert.doesNotMatch(card.deadline_text, /page (still )?says/i);
  assert.equal(ENTRIES.find((e) => e.id === CINCINNATI).status, "closed-expect-reopen");
});

test("Go4Brains stays closed-expect-reopen and says the March 1, 2026 deadline has passed", () => {
  const card = program(GO4BRAINS);
  assert.equal(card.status, "closed-expect-reopen");
  assert.match(card.deadline_text, /March 1, 2026/);
  assert.match(card.deadline_text, /has passed/);
  assert.doesNotMatch(card.deadline_text, /page (still )?says/i);
  assert.equal(ENTRIES.find((e) => e.id === GO4BRAINS).status, "closed-expect-reopen");
});

test("neither card uses a dash character", () => {
  const dashes = new RegExp("[" + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + "]");
  assert.doesNotMatch(JSON.stringify(program(CINCINNATI)), dashes);
  assert.doesNotMatch(JSON.stringify(program(GO4BRAINS)), dashes);
});
