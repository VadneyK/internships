// Indiana, Minnesota and Texas no-permit lines carry the "on the pages we read" caveat (ticket r1-accuracy-3).
// Run with: node --test tests/r1-accuracy-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const HEDGE = /the (state )?pages we read/;

test("IN permit, issuer, adult and job text carry the pages-we-read caveat", () => {
  const IN = PM.states.in;
  for (const [name, text] of [["permit", IN.permit], ["issuer", IN.issuer], ["adult", IN.adult], ["kinds.job.text", IN.kinds.job.text]]) {
    assert.match(text, HEDGE, `IN ${name} is missing the caveat`);
  }
});

test("MN job text and under-16 first sentence carry the pages-we-read caveat", () => {
  const MN = PM.states.mn;
  assert.match(MN.kinds.job.text, /general work permit on the pages we read\./);
  const firstSentence = MN.kinds.job.under.text.split(/(?<=\.)\s/)[0];
  assert.match(firstSentence, /on the pages we read/);
});

test("TX job text carries the pages-we-read caveat and still says no permit is required", () => {
  const TX = PM.states.tx;
  assert.match(TX.kinds.job.text, /on the pages we read/);
  assert.match(TX.kinds.job.text, /does not require a work permit for teens/);
});

test("no new rule is asserted: the no-permit answers stay permit: false", () => {
  assert.equal(PM.states.in.kinds.job.permit, false);
  assert.equal(PM.states.mn.kinds.job.permit, false);
  assert.equal(PM.states.tx.kinds.job.permit, false);
});
