// Ticket r3-accuracy-3: the Get ready opening paragraph must not say the Social Security card
// applies to most jobs. The card is one Form I-9 document choice, and you need your SSN.
// Run with: node --test tests/r3-accuracy-3-ready-ssn-card-wording.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const FILES = ["src/ready.html", "ready.html"];

const OLD = "the Social Security card, the federal W-4";
const NEW = "The Form I-9 papers, the federal W-4 and Social Security and Medicare taxes apply to most jobs in every state, and you need your Social Security number. The card is one of the Form I-9 document choices, and a birth certificate with an official seal can work instead (<a href=\"#papers\">see your papers</a>).";
const EXCEPTION = "The exception is working for your parent's own sole proprietorship, or a partnership where both partners are your parents, when you are under 18. It does not apply to a corporation (see <a href=\"paycheck.html\">Your first paycheck</a>).";

test("the phrase 'the Social Security card, the federal W-4' is gone from ready.html", () => {
  for (const file of FILES) {
    assert.doesNotMatch(rd(file), /the Social Security card, the federal W-4/, file);
  }
});

test("the opening paragraph says you need your SSN and the card is one I-9 choice", () => {
  for (const file of FILES) {
    const src = rd(file);
    assert.ok(src.includes(NEW), `${file} is missing the corrected opening sentence`);
  }
});

test("the exception sentence is kept word for word", () => {
  for (const file of FILES) {
    assert.ok(rd(file).includes(EXCEPTION), `${file} changed the exception sentence`);
  }
});

test("the #papers link points at a section that exists on the page", () => {
  for (const file of FILES) {
    const src = rd(file);
    assert.match(src, /<section id="papers">/, `${file} has no #papers section`);
    assert.match(src, /<a href="#papers">see your papers<\/a>/, `${file} is missing the link to #papers`);
  }
});
