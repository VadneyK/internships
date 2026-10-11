// Ticket r2-teen-flow-4: the Safe at work "Next" line carries the state picked at the top of the page.
// paycheck.html gets ?state= for ga, ny, il, ca. permit.html gets it for the four picker states.
// rules.html gets it for ca (the page it describes). states.html stays plain (it lists other states only).
// "All states" and "Another state" leave every link plain.
// Run with: node --test tests/r2-teen-flow-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

function nextHrefs(document) {
  return Object.fromEntries([...document.querySelectorAll("#sNext a")].map((a) => [a.textContent.trim(), a.getAttribute("href")]));
}

const PLAIN = {
  "Your first paycheck": "paycheck.html",
  "Use the work permit finder": "permit.html",
  "the California work rules": "rules.html",
  "the rules in Georgia, New York and Illinois": "states.html",
};

function pick(window, document, value) {
  const sel = document.getElementById("sState");
  sel.value = value;
  sel.dispatchEvent(new window.Event("change"));
}

test("r2-teen-flow-4: picking ny sets state=ny on paycheck and permit, and not on states", async () => {
  const { document, window, errors } = await loadPage("safety.html");
  await tick(120);
  assert.deepEqual(errors, []);
  pick(window, document, "ny");
  const h = nextHrefs(document);
  assert.equal(h["Your first paycheck"], "paycheck.html?state=ny");
  assert.equal(h["Use the work permit finder"], "permit.html?state=ny");
  assert.equal(h["the California work rules"], "rules.html");
  assert.equal(h["the rules in Georgia, New York and Illinois"], "states.html");
});

test("r2-teen-flow-4: picking other after ny leaves every Next link plain", async () => {
  const { document, window, errors } = await loadPage("safety.html");
  await tick(120);
  assert.deepEqual(errors, []);
  pick(window, document, "ny");
  pick(window, document, "other");
  const h = nextHrefs(document);
  for (const [text, href] of Object.entries(PLAIN)) assert.equal(h[text], href, text);
});

test("r2-teen-flow-4: picking all states leaves every Next link plain", async () => {
  const { document, window } = await loadPage("safety.html");
  await tick(120);
  pick(window, document, "ca");
  pick(window, document, "");
  const h = nextHrefs(document);
  for (const [text, href] of Object.entries(PLAIN)) assert.equal(h[text], href, text);
});

test("r2-teen-flow-4: ?state=ca on arrival carries state to paycheck, permit and rules", async () => {
  const { document } = await loadPage("safety.html", { search: "?state=ca" });
  await tick(120);
  const h = nextHrefs(document);
  assert.equal(h["Your first paycheck"], "paycheck.html?state=ca");
  assert.equal(h["Use the work permit finder"], "permit.html?state=ca");
  assert.equal(h["the California work rules"], "rules.html?state=ca");
  assert.equal(h["the rules in Georgia, New York and Illinois"], "states.html");
});
