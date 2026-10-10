// Rules page: the $400 tax rule keeps "after your costs", and pet care is not listed as a no-permit example (ticket r3-accuracy-4).
// Run with: node --test tests/r3-accuracy-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const SRC = fs.readFileSync(new URL("../src/rules.html", import.meta.url), "utf8");
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

test("the $400 self-employment tax sentence keeps 'after your costs'", () => {
  const m = SRC.match(/<li>[^<]*\$400 or more in a year[^<]*<\/li>/);
  assert.ok(m, "the $400 tax sentence is on the page");
  assert.match(m[0], /once you earn \$400 or more in a year after your costs\./);
});

test("the 'You do not need a permit for' list does not contain 'pet care'", () => {
  const h3 = SRC.indexOf("<h3>You do not need a permit for</h3>");
  assert.ok(h3 > 0, "the no-permit heading is on the page");
  const ulEnd = SRC.indexOf("</ul>", h3);
  const list = SRC.slice(h3, ulEnd);
  assert.ok(list.includes("<li>"), "the list has items");
  assert.doesNotMatch(list, /pet care/i);
});

test("the no-permit note says a self-employed minor needs no permit and asks the Labor Commissioner about pet care", () => {
  assert.match(SRC, /A self-employed minor needs no permit\. Pet care is not named on the state chart, so ask the Labor Commissioner at 833-526-4636\./);
});

test("ca kinds.own does not list 'pet care' as an example", () => {
  const text = PM.states.ca.kinds.own.text;
  const examples = text.match(/\(([^)]*)\)/g) || [];
  assert.ok(examples.length >= 1, "the own text has an example list");
  for (const ex of examples) assert.doesNotMatch(ex, /pet care/i, "example list: " + ex);
  assert.match(text, /A self-employed minor needs no permit\. Pet care is not named on the state chart, so ask the Labor Commissioner at 833-526-4636\./);
});
