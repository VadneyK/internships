// r1-accuracy-1: the New York working papers card on states.html must not be
// stronger than data/younger.json and data/permits.json. It must keep the age
// limit (14 for babysitting, 14 and 15 for yard work) and the no power
// machinery condition, and it must say yard work for 12 and 13 is not stated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const SENTENCES = [
  "No working papers are needed for babysitting, but New York DOL says the babysitter must be at least 14.",
  "At 14 and 15, casual yard work or chores at a home need no certificate if no power machinery is used.",
  "Yard work for 12 and 13 year olds is not stated.",
];

test("src/states.html NY card states the age and power machinery limits", () => {
  const src = read("src/states.html");
  for (const s of SENTENCES) {
    assert.ok(src.includes(s), `missing sentence: ${s}`);
  }
});

test("src/states.html no longer uses the unqualified exemption wording", () => {
  const src = read("src/states.html");
  assert.ok(
    !src.includes("Babysitting, casual yard work or chores at home or a nonprofit, farming and caddying are exempt"),
    "old unqualified exemption sentence is still present",
  );
});

test("generated states.html carries the same NY sentences as src", () => {
  const out = read("states.html");
  for (const s of SENTENCES) {
    assert.ok(out.includes(s), `generated page missing sentence: ${s}`);
  }
});

test("younger.json NY yard work cell still states the same age and machinery rule", () => {
  const younger = read("data/younger.json");
  assert.ok(
    younger.includes("Not stated for 12 and 13. At 14 and 15, casual yard work and chores at a home need no certificate if no power machinery is used."),
  );
});
