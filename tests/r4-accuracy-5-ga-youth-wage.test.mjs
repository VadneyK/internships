// Georgia's optional $4.25 under-20 wage is named in the money gaps (ticket r4-accuracy-5).
// Run with: node --test tests/r4-accuracy-5-ga-youth-wage.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const states = read("src/states.html");
const money = JSON.parse(read("data/money.json"));

const YOUTH = "Federal law lets an employer pay workers under 20 $4.25 an hour during their first 90 consecutive days. That is optional for the employer. This estimate uses $7.25 (see Georgia on the Other states page).";

test("money.json gaps has the Georgia youth wage line, word for word", () => {
  assert.ok(money.gaps.includes(YOUTH), "gaps has the youth wage line");
});

test("states.html still states the $4.25 youth wage and the 90 consecutive day rule", () => {
  assert.ok(states.includes("$4.25"), "states.html has $4.25");
  assert.ok(states.includes("90 consecutive days"), "states.html has 90 consecutive days");
});

test("paycheck page renders the Georgia youth wage gap as a list item", async () => {
  const { document, errors } = await loadPage("paycheck.html"); await tick(200);
  assert.deepEqual(errors, []);
  const items = [...document.querySelectorAll("#mGaps li")].map((li) => li.textContent);
  assert.ok(items.includes(YOUTH), "mGaps has the youth wage list item");
});
