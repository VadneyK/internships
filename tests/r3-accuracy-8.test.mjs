// Interview data: the two undated 'say' rules are labeled or attributed, not left bare.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const RAW = fs.readFileSync(new URL("../data/interview.json", import.meta.url), "utf8");
const D = JSON.parse(RAW);
const LABEL = "Our suggestion, not from a source.";

test("refs.rules[0] keeps the one to three rule and labels the ask-one-more part as ours", () => {
  const t = D.refs.rules[0];
  assert.match(t, /^Have one to three people ready\. /);
  assert.match(t, /If a form asks for more, ask one more teacher, coach or supervisor first\. That part is our suggestion, not from a source\.$/);
});

test("day[4] attributes the formality advice to the Cal Poly Pomona guide", () => {
  assert.match(D.day[4], /^Cal Poly Pomona says to dress to match the formality of what your future boss might wear\. /);
});

test("day tips still carry the suggestion label where used", () => {
  assert.ok(D.day[1].endsWith(LABEL));
});

test("interview.json has no em dash or en dash", () => {
  assert.ok(!/[\u2013\u2014]/.test(RAW));
});
