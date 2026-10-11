// r1-accuracy-10: the New York odd-jobs permit answer must keep the power
// machinery condition that the source pages and the other two NY copies state.
// Without it, a 15 year old using a mower reads a no-permit answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const PHRASE = "no power machinery";
const ODD_TEXT =
  "No working papers are needed for babysitting, but New York DOL says the babysitter must be at least 14. At 14 and 15, casual yard work or chores at a home need no certificate if no power machinery is used. Yard work for 12 and 13 year olds is not stated. Ask: 888-469-7365 or 888-525-2267.";

test("permits.json NY odd-jobs text is the sourced wording with the power machinery condition", () => {
  const permits = JSON.parse(read("data/permits.json"));
  const odd = permits.states.ny.kinds.odd;
  assert.equal(odd.text, ODD_TEXT);
  assert.ok(odd.text.includes(PHRASE), "odd text must carry the power machinery condition");
});

test("younger.json NY yard work cell carries the same power machinery phrase", () => {
  const younger = read("data/younger.json");
  assert.ok(younger.includes("At 14 and 15, casual yard work and chores at a home need no certificate if no power machinery is used."));
  assert.ok(younger.includes(PHRASE));
});

test("src/states.html NY card carries the same power machinery phrase", () => {
  const src = read("src/states.html");
  assert.ok(src.includes("At 14 and 15, casual yard work or chores at a home need no certificate if no power machinery is used."));
  assert.ok(src.includes(PHRASE));
});
