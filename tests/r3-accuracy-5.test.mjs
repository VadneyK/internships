// Ticket r3-accuracy-5: Illinois and Georgia 16 and 17 hour wording says what the pages we read say, no more.
// Run with: node --test tests/r3-accuracy-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const permits = JSON.parse(read("data/permits.json"));
const states = read("src/states.html");

const IL_16 = "The pages we read set no hour limit at 16 and 17 (the Illinois child labor law covers workers under 16). Ask the US Department of Labor or your state agency before you plan long shifts.";
const GA_16_LEAD = "The pages we read set no hour limit at 16 and 17 (the Georgia work permit rule covers minors under 16). Ask the US Department of Labor or your state agency before you plan long shifts.";

test("permits.json Illinois 16 hour line uses the pages-we-read wording", () => {
  assert.equal(permits.states.il.hours["16"], IL_16);
});

test("permits.json Georgia 16 hour line uses the pages-we-read wording", () => {
  assert.ok(permits.states.ga.hours["16"].startsWith(GA_16_LEAD), permits.states.ga.hours["16"]);
});

test("states.html Illinois and Georgia 16 and 17 lines use the same wording", () => {
  assert.ok(states.includes(`<b>16 and 17:</b> ${IL_16}</p>`), "Illinois line");
  assert.ok(states.includes(`<b>16 and 17:</b> ${GA_16_LEAD}`), "Georgia line");
});

test("old unqualified law claims are gone from the data and the page", () => {
  const banned = [
    "does not limit your hours at 16 and 17",
    "does not limit your hours, and federal law does not either",
    "Georgia and federal law set no hour limits",
  ];
  const data = JSON.stringify(permits);
  for (const phrase of banned) {
    assert.ok(!data.includes(phrase), `permits.json still has: ${phrase}`);
    assert.ok(!states.includes(phrase), `states.html still has: ${phrase}`);
  }
});
