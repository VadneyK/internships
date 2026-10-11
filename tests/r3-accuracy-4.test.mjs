// r3-accuracy-4: the Illinois unpaid wages phone number 312-793-2804 has no source
// in the repo and is not on labor.illinois.gov/unpaidwages.html (read Oct 11, 2026).
// The Illinois wage line must point to that page and its link instead of a number.
// Run with: node --test tests/r3-accuracy-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const money = JSON.parse(read("data/money.json"));
const parents = JSON.parse(read("data/parents.json"));

const UNSOURCED = "312-793-2804";
const WAGE_PAGE = "Use the Illinois unpaid wages page";

test("money.json Illinois wage line names the page, not the unsourced number", () => {
  const il = money.states.find((s) => s.id === "il");
  assert.ok(il, "money.json has an il state");
  assert.equal(il.call, WAGE_PAGE);
  assert.ok(il.links.some((l) => l.u === "https://labor.illinois.gov/unpaidwages.html"));
});

test("parents.json unpaid wages line has no 312-793-2804", () => {
  const text = JSON.stringify(parents);
  assert.equal(text.includes(UNSOURCED), false);
  assert.ok(text.includes("Illinois: use the Illinois unpaid wages page."));
});

test("no data file keeps the unsourced Illinois wage number", () => {
  for (const f of ["data/money.json", "data/parents.json"]) {
    assert.equal(read(f).includes(UNSOURCED), false, f);
  }
});
