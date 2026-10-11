// The rules page must not tell a teen "you can say no" about unsafe or not-allowed work, because the
// California pages we read do not say that in plain words (data/safety.json). The paragraph instead
// names the Labor Commissioner number and points to Safe at work (ticket r3-accuracy-5).
// Run with: node --test tests/r3-accuracy-5-rules-no-refusal-claim.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const RULES = rd("rules.html");
const SRC_RULES = rd("src/rules.html");
const CAVEAT = "The California pages we read do not say in plain words that a teen may refuse unsafe work, so ask the Labor Commissioner at 833-526-4636.";

test("rules page no longer says 'you can say no'", () => {
  assert.ok(!RULES.includes("you can say no"), "rules.html still says 'you can say no'");
  assert.ok(!SRC_RULES.includes("you can say no"), "src/rules.html still says 'you can say no'");
});

test("rules page carries the California caveat and the Safe at work link in both files", () => {
  for (const [name, html] of [["rules.html", RULES], ["src/rules.html", SRC_RULES]]) {
    assert.ok(html.includes(CAVEAT), `${name} missing the California caveat`);
    assert.ok(html.includes('<a href="safety.html">Safe at work</a>'), `${name} missing the Safe at work link`);
  }
});
