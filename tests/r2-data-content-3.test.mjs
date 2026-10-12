// r2-data-content-3: dates and ages that a card's own text already states are filled in on the card.
// Run with: node --test tests/r2-data-content-3.test.mjs
// Reads the four program files only. No DOM.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function card(id) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "programs", `${id}.json`), "utf8"));
}

test("Cheyenne Mountain Zoo card: applications open Feb 1 to Feb 10, 2027 are filled in", () => {
  const c = card("cheyenne-mountain-zoo-junior-zoo-keepers-summer-teen-program");
  assert.equal(c.status, "opens-soon");
  assert.equal(c.opens_iso, "2027-02-01");
  assert.equal(c.deadline_iso, "2027-02-10");
  assert.match(c.deadline_text, /February 1 to February 10, 2027/);
});

test("IMSA RISE card: no stale opens_iso from July 30, 2026 is left on an unconfirmed card", () => {
  const c = card("imsa-rise-online-research-program");
  assert.equal(c.status, "unconfirmed");
  assert.ok(!c.opens_iso, "opens_iso must be empty for an unconfirmed card");
  assert.match(c.deadline_text, /July 30, 2026/);
});

test("Bexley library teen volunteers: min_age is 13 and who_can_apply is unchanged", () => {
  const c = card("columbus-bexley-library-teen-volunteers");
  assert.equal(c.min_age, 13);
  assert.equal(c.who_can_apply, "Teens who are at least 13 years old or in grades 7 to 12 during the 2026-2027 school year. The page says the teen program is currently full.");
});

test("DuPage Children's Museum volunteers: min_age is 14 and who_can_apply is unchanged", () => {
  const c = card("dupage-childrens-museum-teen-and-junior-volunteers");
  assert.equal(c.min_age, 14);
  assert.equal(c.who_can_apply, "Teen and adult volunteers: age 14 or entering high school. Junior volunteers: junior high school students.");
});
