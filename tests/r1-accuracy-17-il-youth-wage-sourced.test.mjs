// The Illinois under-18 wage must be sourced the same way in every file that states it.
// The IDOL minimum wage page (labor.illinois.gov/laws-rules/fls/minimum-wage-law.html) has a table with
// $15 for workers 18 and older and $13 for youths under 18 working less than 650 hours per calendar year,
// so the repo states $13.00 with that page as the source (ticket r1-accuracy-17).
// Run with: node --test tests/r1-accuracy-17-il-youth-wage-sourced.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const permits = JSON.parse(rd("data/permits.json"));
const wages = JSON.parse(rd("data/state-wages.json"));
const states = rd("src/states.html");
const row = wages.states.find((s) => s.id === "il");
const IDOL_WAGE_PAGE = "https://labor.illinois.gov/laws-rules/fls/minimum-wage-law.html";

test("permits il.wage and state-wages il.youth both state the $13 under-18 rate", () => {
  assert.ok(permits.states.il.wage.includes("$13.00"), "permits il.wage lacks $13.00");
  assert.ok(row.youth.includes("$13"), "state-wages il.youth lacks $13");
  assert.ok(row.youth.includes("650 hours"), "state-wages il.youth lacks 650 hours");
});

test("state-wages il.quote carries the IDOL table text for the $13 figure", () => {
  assert.equal(row.url, IDOL_WAGE_PAGE);
  assert.ok(row.quote.includes("$13"), "quote lacks $13");
  assert.ok(row.quote.includes("Youths (Under 18) (Working Less Than 650 Hours Per Calendar Year)"), "quote lacks the table header");
});

test("states.html Illinois section gives $13.00 with 650 hours and names the IDOL minimum wage page", () => {
  const m = states.match(/<section id="illinois">([\s\S]*?)<\/section>/);
  assert.ok(m, "Illinois section not found in states.html");
  assert.match(m[1], /\$13\.00[^<]*650 hours/, "Illinois section lacks $13.00 with 650 hours");
  assert.ok(m[1].includes(IDOL_WAGE_PAGE), "Illinois section does not link the IDOL minimum wage page");
  assert.ok(!/every IDOL page/.test(m[1]), "Illinois section still claims every IDOL page states the figure");
});
