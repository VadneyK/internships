// Interview tips must not carry numbers or caps that their cited sources do not say (ticket r2-accuracy-3).
// Run with: node --test tests/r2-accuracy-3-interview-source-numbers.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const raw = fs.readFileSync(new URL("../data/interview.json", import.meta.url), "utf8");
const data = JSON.parse(raw);

const unsourced = ["four people", "about a minute", "three or four", "at most one polite"];

for (const phrase of unsourced) {
  test(`interview.json no longer says "${phrase}"`, () => {
    assert.ok(!raw.includes(phrase), `interview.json still contains "${phrase}"`);
  });
}

test("refs.rules[0] asks for one to three references", () => {
  assert.match(data.refs.rules[0], /one to three/);
});

test("refs.rules[1] marks the babysitting family as our suggestion", () => {
  assert.match(data.refs.rules[1], /A family you babysit for is our suggestion, not from a source\./);
});

test("questions[0].tip gives no minute count", () => {
  assert.match(data.questions[0].tip, /^Keep it short:/);
  assert.doesNotMatch(data.questions[0].tip, /\bminute/i);
});

test("questions[6].tip uses a handful of stories", () => {
  assert.match(data.questions[6].tip, /^Have a handful of short stories ready/);
});

test("thanks.timing keeps the 1 to 2 day phrase and the follow-up line", () => {
  assert.match(data.thanks.timing, /1 to 2 days/);
  assert.match(data.thanks.timing, /follow up with the employer to check on the job/);
});
