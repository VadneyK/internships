// Day-of tips: each tip names the guide that says it, or carries the honest "our suggestion" label.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const D = JSON.parse(fs.readFileSync(new URL("../data/interview.json", import.meta.url), "utf8"));
const LABEL = "Our suggestion, not from a source.";
const NAMES = /Minnesota CareerForce|Addison library|Cal Poly Pomona|Our sources/;

test("every day tip names a source or carries the suggestion label", () => {
  D.day.forEach((t, i) => {
    assert.ok(NAMES.test(t) || t.includes(LABEL), `day[${i}] has neither a source name nor the label: ${t}`);
  });
});

test("day[2] phone tip names the Addison guide for silent mode and labels the car or bag part", () => {
  const t = D.day[2];
  assert.match(t, /The Addison library guide says to put your phone on silent or Do Not Disturb/);
  assert.ok(t.endsWith(LABEL));
  assert.ok(!/leave it in the car or your bag\./.test(t.replace("is also an option.", "")), "car or bag must not be stated as sourced");
});

test("day[3] greeting tip names the Addison guide for eye contact and the Cal Poly Pomona guide for handshake", () => {
  const t = D.day[3];
  assert.match(t, /The Addison library guide says to make eye contact\./);
  assert.match(t, /The Cal Poly Pomona guide says a handshake should be strong and confident\./);
  assert.ok(!t.includes(LABEL), "both sentences are sourced, so no suggestion label");
});

test("day[5] parent tip names the Cal Poly Pomona guide", () => {
  assert.match(D.day[5], /^The Cal Poly Pomona guide says a parent can give you a ride but should not come into the interview with you\.$/);
});

test("day tips and daySource titles have no em dash or en dash", () => {
  assert.ok(![...D.day, ...D.daySource.map((s) => s.title)].some((t) => /[\u2013\u2014]/.test(t)));
});
