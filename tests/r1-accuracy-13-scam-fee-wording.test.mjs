// Scam fee wording on the rules page must not claim an absolute rule that the FTC data spotlight does not state.
// The spotlight says paying to get paid is a sign of a scam; it does not say every fee to get hired is a scam,
// so the page uses neutral wording with no FTC attribution (ticket r1-accuracy-13).
// Run with: node --test tests/r1-accuracy-13-scam-fee-wording.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const RULES = rd("rules.html");
const SRC_RULES = rd("src/rules.html");
const NEUTRAL = "A job that asks you to pay is a red flag. Show a parent before you pay anything.";

test("rules page drops the absolute 'never charge' and 'do not charge you' claims", () => {
  assert.ok(!RULES.includes("never charge"), "rules.html still says 'never charge'");
  assert.ok(!RULES.includes("do not charge you to hire you"), "rules.html still says 'do not charge you to hire you'");
  assert.ok(!SRC_RULES.includes("never charge"), "src/rules.html still says 'never charge'");
  assert.ok(!SRC_RULES.includes("do not charge you to hire you"), "src/rules.html still says 'do not charge you to hire you'");
});

test("rules page uses the neutral red-flag wording in both places", () => {
  assert.ok(RULES.includes(NEUTRAL), "rules.html missing neutral wording");
  assert.ok(SRC_RULES.includes(NEUTRAL), "src/rules.html missing neutral wording");
  assert.equal(RULES.split(NEUTRAL).length - 1, 2, "expected the neutral wording in the quick answer and the scam checklist");
});

test("any 'never charge' wording left on the page must name the FTC", () => {
  for (const html of [RULES, SRC_RULES]) {
    for (const m of html.matchAll(/[^.<>]*never charge[^.<>]*/g)) {
      assert.ok(/FTC/.test(m[0]), "unsourced absolute fee claim: " + m[0].trim());
    }
  }
});
