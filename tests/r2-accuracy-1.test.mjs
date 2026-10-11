// Fast food $20.00 minimum named wherever the California $16.90 rate is the only rate (ticket r2-accuracy-1).
// Run with: node --test tests/r2-accuracy-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const SENTENCE = "Fast food workers have a higher state minimum of $20.00 (as of the DIR minimum wage page we read on Oct 7, 2026).";

test("permits.json California wage names the fast food $20.00 minimum", () => {
  const permits = JSON.parse(read("data/permits.json"));
  assert.ok(permits.states.ca.wage.includes(SENTENCE), "ca.wage is missing the fast food sentence");
});

test("money.json gaps has the fast food $20.00 line, word for word", () => {
  const money = JSON.parse(read("data/money.json"));
  assert.ok(money.gaps.includes(SENTENCE), "gaps is missing the fast food sentence");
});

test("rules.html 'What is the pay?' quick answer names the fast food $20.00 minimum", () => {
  const html = read("src/rules.html");
  const card = html.match(/<h3>What is the pay\?<\/h3><p>([\s\S]*?)<\/p>/);
  assert.ok(card, "quick answer card not found");
  assert.ok(card[1].includes(SENTENCE), "quick answer is missing the fast food sentence");
});
