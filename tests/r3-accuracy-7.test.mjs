// The thank-you timing on the playbook, the ready checklist and the playbook tracker
// uses the same sourced phrase as data/interview.json thanks.timing (ticket r3-accuracy-7).
// Run with: node --test tests/r3-accuracy-7.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const interview = JSON.parse(read("data/interview.json"));
const timing = interview.thanks && interview.thanks.timing;

// The sourced phrase, for example "1 to 2 days".
const match = typeof timing === "string" ? timing.match(/\b\d+ to \d+ days\b/) : null;
const phrase = match ? match[0] : null;

const surfaces = [
  "src/playbook.html",
  "src/ready.html",
  "assets/js/playbook.js",
];

const builtRoots = ["playbook.html", "ready.html"];

const banned = [/within 24 hours/i, /within a day/i];

test("interview.json thanks.timing has a '<n> to <n> days' phrase", () => {
  assert.ok(phrase, `thanks.timing has no 'N to N days' phrase: ${timing}`);
});

for (const rel of surfaces) {
  test(`${rel} uses the sourced thank-you phrase`, () => {
    assert.ok(phrase, "no sourced phrase to compare against");
    assert.ok(read(rel).includes(phrase), `${rel} does not contain "${phrase}"`);
  });

  test(`${rel} has no unsourced thank-you deadline`, () => {
    const text = read(rel);
    for (const pattern of banned) {
      assert.doesNotMatch(text, pattern, `${rel} still has ${pattern}`);
    }
  });
}

for (const rel of builtRoots) {
  test(`built ${rel} carries the sourced phrase and no unsourced deadline`, () => {
    const text = read(rel);
    assert.ok(phrase, "no sourced phrase to compare against");
    assert.ok(text.includes(phrase), `${rel} does not contain "${phrase}"`);
    for (const pattern of banned) {
      assert.doesNotMatch(text, pattern, `${rel} still has ${pattern}`);
    }
  });
}
