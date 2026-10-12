// r1-accuracy-19: the 12 to 14 grid (data/younger.json) must carry the same
// caveats as src/rules.html and data/permits.json. The California babysitting
// and yard work cells must point to the Labor Commissioner for the hour limits.
// The Illinois babysitting cell must keep the "not part of a business" condition.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const YOUNGER = JSON.parse(readFileSync(join(root, "data", "younger.json"), "utf8"));

const row = (name) => YOUNGER.rows.find((r) => r.job === name);
const cell = (name, state) => row(name).cells[state].t;

const LABOR_CALL = "833-526-4636";
const HOURS_CAVEAT = "The chart does not say these jobs skip the hour limits. Ask the Labor Commissioner at 833-526-4636 before you plan how much you can do.";

test("younger.json ca Babysitting cell carries the hour-limit caveat and the Labor Commissioner number", () => {
  const text = cell("Babysitting", "ca");
  assert.ok(text.includes(HOURS_CAVEAT), `caveat missing: ${text}`);
  assert.ok(text.includes(LABOR_CALL), "Labor Commissioner number missing");
});

test("younger.json ca Yard work cell carries the hour-limit caveat and the Labor Commissioner number", () => {
  const text = cell("Yard work for a neighbor", "ca");
  assert.ok(text.includes(HOURS_CAVEAT), `caveat missing: ${text}`);
  assert.ok(text.includes(LABOR_CALL), "Labor Commissioner number missing");
});

test("younger.json il Babysitting cell keeps the not-part-of-a-business condition", () => {
  const text = cell("Babysitting", "il");
  assert.equal(
    text,
    "No permit for babysitting outside school hours at a private home when the work is not part of a business."
  );
  assert.ok(text.includes("not part of a business"), "condition missing");
});

test("younger.json odd-job cells contain no dash characters", () => {
  for (const name of ["Babysitting", "Yard work for a neighbor"]) {
    for (const state of ["ca", "il"]) {
      assert.ok(!/[\u2013\u2014]/.test(cell(name, state)), `dash in ${name} ${state}`);
    }
  }
});
