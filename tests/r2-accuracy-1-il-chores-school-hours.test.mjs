// r2-accuracy-1: Illinois odd jobs. The Illinois DOL FAQ gives the school-hours
// condition for household chores and babysitting, and its raking example
// carries the same condition. The yard row and the odd-job text must say so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const YOUNGER = JSON.parse(readFileSync(join(root, "data", "younger.json"), "utf8"));
const PERMITS = JSON.parse(readFileSync(join(root, "data", "permits.json"), "utf8"));

const yardRow = YOUNGER.rows.find((r) => /yard work/i.test(r.job));
const yardIl = yardRow && yardRow.cells && yardRow.cells.il && yardRow.cells.il.t;
const oddIl = PERMITS.states.il.kinds.odd.text;

test("Illinois yard work row says the raking rule holds outside school hours", () => {
  assert.ok(yardIl, "Yard work row has an Illinois cell");
  assert.equal(
    yardIl,
    "Raking a neighbor's leaves for pay outside school hours needs no permit. If a landscaping company hires you, the child labor law applies."
  );
});

test("Illinois yard work row has no unconditional raking wording", () => {
  assert.ok(!/Raking a neighbor's leaves for pay needs no permit\./.test(yardIl));
});

test("Illinois odd-job text keeps the school-hours condition next to the raking sentence", () => {
  assert.match(oddIl, /household chores or babysitting outside school hours at a private home/);
  assert.match(oddIl, /Raking a neighbor's leaves is its example\./);
  const raking = oddIl.indexOf("Raking a neighbor's leaves");
  const hours = oddIl.indexOf("school hours");
  assert.ok(hours >= 0 && raking >= 0 && Math.abs(raking - hours) < 200, "school hours sits next to the raking sentence");
});

test("Illinois odd-job text drops the old unconditional raking wording and the not-stated line", () => {
  assert.ok(!/none for raking a neighbor's leaves for pay/.test(oddIl));
  assert.ok(!/Other odd jobs are not stated/.test(oddIl));
});

test("Illinois odd-job text keeps the child labor law line and the DOL phone number", () => {
  assert.match(oddIl, /If a landscaping company hires you, the child labor law applies\./);
  assert.match(oddIl, /Ask Illinois DOL child labor questions: 312-793-5570\./);
});

test("Illinois yard and odd-job texts contain no en dash or em dash", () => {
  for (const text of [yardIl, oddIl]) {
    assert.ok(!/[\u2013\u2014]/.test(text), `dash found in: ${text}`);
  }
});
