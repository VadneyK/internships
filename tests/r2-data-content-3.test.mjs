import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-data-content-3.
// Teens Reach is listed on the SJPL volunteer page, so there is one card for both roles.

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const ENTRIES = JSON.parse(read("data/entries.json"));
const LITE = JSON.parse(read("data/entries-lite.json"));
const card = ENTRIES.find((e) => e.id === "san-jose-public-library-teen-volunteer");

test("the separate Teens Reach card is gone", () => {
  assert.ok(!ENTRIES.some((e) => e.id === "sjpl-teens-reach"));
  assert.ok(!LITE.some((e) => e.id === "sjpl-teens-reach"));
  assert.ok(!fs.existsSync(new URL("../data/programs/sjpl-teens-reach.json", import.meta.url)));
});

test("one card covers both roles with ages stated plainly", () => {
  assert.ok(card);
  assert.match(card.name, /Teens Reach/);
  assert.match(card.name, /Teen Book Reviewer/);
  assert.equal(card.min_age, 13);
  assert.equal(card.max_age, 18);
  assert.match(card.who_can_apply, /13 to 18/);
  assert.match(card.who_can_apply, /Teen Book Reviewer/);
});

test("how_to_apply keeps Better Impact, branch sign-up and both emails", () => {
  assert.match(card.how_to_apply, /Better Impact/);
  assert.match(card.how_to_apply, /branch/i);
  assert.match(card.how_to_apply, /volunteer@sjlibrary\.org/);
  assert.match(card.how_to_apply, /volunteer\.sjpl@sjlibrary\.org/);
});

test("no San Jose library card still says it describes the same program", () => {
  const sjpl = ENTRIES.filter((e) => e.org === "San Jose Public Library");
  assert.ok(sjpl.length > 0);
  sjpl.forEach((e) => assert.doesNotMatch(String(e.notes || ""), /appears to describe the same program|appears to be the same program/i));
});

test("no dash characters in the card", () => {
  assert.doesNotMatch(JSON.stringify(card), new RegExp("[" + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + "]"));
});
