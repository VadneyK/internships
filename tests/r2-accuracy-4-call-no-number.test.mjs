// Every state's "call" text in data/permits.json either gives a phone number
// or says plainly that no number is listed. The page shows this text under a
// "Who to call" heading, so a teen should never see only a website with no note.
// Run with: node --test tests/r2-accuracy-4-call-no-number.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const permits = JSON.parse(readFileSync(join(root, "data", "permits.json"), "utf8"));

const NO_NUMBER = " No phone number is listed on this card. Use the agency website.";
// Same phone pattern the consistency test uses: 800-555-1234, (317) 232-2655, 1-877-709-8185.
const PHONE = /(?:1[-. ])?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/;

test("permits.json has a call field for every state", () => {
  const states = Object.keys(permits.states);
  assert.ok(states.length > 0, "no states in permits.json");
  for (const st of states) {
    const call = permits.states[st].call;
    assert.ok(typeof call === "string" && call.trim() !== "", `${st}: call is missing`);
  }
});

test("every state call gives a phone number or the exact no-number sentence", () => {
  for (const [st, s] of Object.entries(permits.states)) {
    const call = s.call;
    const hasPhone = PHONE.test(call);
    const hasNoNumberSentence = call.endsWith(NO_NUMBER);
    assert.ok(
      hasPhone || hasNoNumberSentence,
      `${st}: call has no phone number and does not end with the no-number sentence: "${call}"`
    );
  }
});

test("a call with no phone number never also claims one in the same sentence", () => {
  for (const [st, s] of Object.entries(permits.states)) {
    if (!s.call.endsWith(NO_NUMBER)) continue;
    const before = s.call.slice(0, s.call.length - NO_NUMBER.length);
    assert.ok(!PHONE.test(before), `${st}: no-number call still contains a phone number: "${s.call}"`);
  }
});

test("the old 'child labor line' wording is gone (no line number is given)", () => {
  for (const [st, s] of Object.entries(permits.states)) {
    assert.doesNotMatch(s.call, /child labor line/i, `${st}: still says "child labor line"`);
  }
});
