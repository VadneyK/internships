// Ticket r3-accuracy-2: the unpaid internship answer must not reduce the federal test to one
// factor ("only if you are the one who mainly benefits"). The Rules page card, its source
// text, and the California permit text in data/permits.json all name the test as several factors.
// Run with: node --test tests/r3-accuracy-2-intern-test-wording.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const OLD_PHRASE = "only if you are the one who mainly benefits";
const FACTOR_PHRASE = "weighs several factors, such as whether you are the one who mainly benefits";
const FACT_SHEET_NOTE = "If the company is the one who mainly benefits, it should be a paid job";
const NONPROFIT = "At a nonprofit, school or library, usually yes.";

const FILES = ["src/rules.html", "rules.html", "data/permits.json"];

for (const rel of FILES) {
  test(`${rel} no longer has the one-factor wording`, () => {
    assert.equal(read(rel).includes(OLD_PHRASE), false);
  });

  test(`${rel} names the federal test as several factors`, () => {
    const text = read(rel);
    assert.ok(text.includes(FACTOR_PHRASE), "factor sentence present");
    assert.ok(text.includes(FACT_SHEET_NOTE), "mainly-benefits outcome sentence present");
  });
}

test("rules.html FAQ card keeps the nonprofit sentence", () => {
  for (const rel of ["src/rules.html", "rules.html"]) {
    assert.ok(read(rel).includes(NONPROFIT), `${rel} keeps nonprofit sentence`);
  }
});

test("permits.json intern text keeps the nonprofit sentence and 5 CCR 10121", () => {
  const permits = JSON.parse(read("data/permits.json"));
  const text = permits.states.ca.kinds.intern.text;
  assert.ok(text.includes("5 CCR 10121"), "regulation cite kept");
  assert.ok(text.includes("An unpaid internship at a nonprofit, school or library is usually fine"));
  assert.ok(text.includes(FACTOR_PHRASE), "factor sentence in permit text");
});
