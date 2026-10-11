// California own-business answer: the chart names newspaper routes only, so tutoring and crafts are not called chart-approved (ticket r3-accuracy-3).
// Run with: node --test tests/r3-accuracy-3-ca-own-examples.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("../src/rules.html", import.meta.url), "utf8");
const BUILT = fs.readFileSync(new URL("../rules.html", import.meta.url), "utf8");
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

const NOTE = "A self-employed minor needs no permit on the chart. The chart names newspaper routes (age 12 or older). Other self-employed jobs, such as tutoring, selling crafts or pet care, are not named, so ask the Labor Commissioner at 833-526-4636.";

test("ca kinds.own text says the chart names only newspaper routes", () => {
  assert.equal(PM.states.ca.kinds.own.text, NOTE);
});

test("ca kinds.own text does not say the chart names tutoring or crafts", () => {
  assert.doesNotMatch(PM.states.ca.kinds.own.text, /Running your own business \(/);
  assert.doesNotMatch(PM.states.ca.kinds.own.text, /chart[^.]*tutoring|tutoring[^.]*chart names/i);
});

test("the no-permit list does not name tutoring or crafts as examples", () => {
  const h3 = SRC.indexOf("<h3>You do not need a permit for</h3>");
  assert.ok(h3 > 0, "the no-permit heading is on the source page");
  const list = SRC.slice(h3, SRC.indexOf("</ul>", h3));
  assert.doesNotMatch(list, /tutoring|selling crafts/i);
});

test("src and built rules page both carry the corrected note", () => {
  assert.ok(SRC.includes(NOTE), "src/rules.html has the note");
  assert.ok(BUILT.includes(NOTE), "rules.html has the note");
  assert.ok(!BUILT.includes("(tutoring, selling crafts)"), "rules.html no longer lists tutoring and crafts as no-permit examples");
});
