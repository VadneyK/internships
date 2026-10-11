import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Five cards whose text said only that dates were missing. A second look at each official page found no window,
// rolling policy or clear closed notice that changes the status, so each stays unconfirmed with no deadline date.
// Three gained a contact from the page in how_to_apply.
const IDS = {
  "evanston-aspire-careers-in-healthcare": "aspire@cityofevanston.org",
  "pittsburgh-ahn-junior-volunteer": null,
  "armory-center-for-the-arts-studio-teen-volunteers": "(626) 792-5101",
  "virginia-governors-school-medicine-health-sciences-roanoke": "MHSgovschool@radford.edu",
  "san-jose-youth-commission": "Youthcommission@sanjoseca.gov",
};

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const CSV = fs.readFileSync(new URL("../data/entries.csv", import.meta.url), "utf8");

function program(id) {
  return JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
}

for (const [id, contact] of Object.entries(IDS)) {
  test(`${id}: stays unconfirmed with no invented date and keeps the page contact`, () => {
    const card = program(id);
    assert.equal(card.status, "unconfirmed");
    assert.equal(card.deadline_iso, null);
    assert.equal(card.opens_iso ?? null, null);
    if (contact) assert.ok(card.how_to_apply.includes(contact), `how_to_apply should name ${contact}`);
  });

  test(`${id}: entries.json and entries.csv match the program file`, () => {
    const card = program(id);
    const entry = ENTRIES.find((e) => e.id === id);
    assert.ok(entry, "entry present in entries.json");
    assert.equal(entry.how_to_apply, card.how_to_apply);
    assert.equal(entry.status, card.status);
    if (contact) assert.ok(CSV.includes(card.how_to_apply), "csv row carries the same how_to_apply text");
  });
}
