// Ticket r1-teen-flow-8: a 12 or 13 year old who gets "Nothing matches yet" on Find sees a link to the ages 12 to 14 page.
// Run with: node --test tests/r1-teen-flow-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const NO_MATCH_Q = "zzzznomatch";
const YOUNGER_LINK = 'a[href="younger.html"]';

// find.js loads the programs with fetch, then renders; wait until the count label is no longer "Loading".
async function loadFind(search) {
  const p = await loadPage("find.html", { search });
  for (let i = 0; i < 80 && /Loading/.test(p.document.getElementById("count").textContent); i++) await tick(25);
  return p;
}

test("r1-teen-flow-8: age 12 with a zero-match search shows the ages 12 to 14 link in the empty card", async () => {
  const { document, errors } = await loadFind("?age=12&q=" + NO_MATCH_Q);
  const out = document.getElementById("out");
  assert.match(out.textContent, /Nothing matches yet/, "empty card is shown");
  assert.ok(document.getElementById("emptyReset"), "keeps the Clear all filters button");
  const link = out.querySelector(YOUNGER_LINK);
  assert.ok(link, "empty card has a link to younger.html");
  assert.equal(link.textContent, "ages 12 to 14 page");
  assert.match(out.textContent, /Under 14\? Read the ages 12 to 14 page\./);
  assert.deepEqual(errors, []);
});

test("r1-teen-flow-8: age 13 with a zero-match search also shows the link", async () => {
  const { document, errors } = await loadFind("?age=13&q=" + NO_MATCH_Q);
  assert.match(document.getElementById("out").textContent, /Nothing matches yet/);
  assert.ok(document.getElementById("out").querySelector(YOUNGER_LINK), "age 13 gets the link");
  assert.deepEqual(errors, []);
});

test("r1-teen-flow-8: age 15 with the same zero-match search has no younger link", async () => {
  const { document, errors } = await loadFind("?age=15&q=" + NO_MATCH_Q);
  const out = document.getElementById("out");
  assert.match(out.textContent, /Nothing matches yet/, "empty card is shown");
  assert.equal(out.querySelector(YOUNGER_LINK), null, "no younger.html link for age 15");
  assert.equal(out.textContent.includes("Under 14?"), false);
  assert.deepEqual(errors, []);
});

test("r1-teen-flow-8: the empty My list card (nothing saved) has no younger link, even at age 12", async () => {
  const { document, errors } = await loadFind("?age=12");
  document.getElementById("savedOnly").click();
  await tick();
  const out = document.getElementById("out");
  assert.match(out.textContent, /Your list is empty/, "saved-list empty card is shown");
  assert.equal(out.querySelector(YOUNGER_LINK), null, "no younger.html link in the My list card");
  assert.equal(out.textContent.includes("Under 14?"), false);
  assert.deepEqual(errors, []);
});
