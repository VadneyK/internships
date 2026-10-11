// Ticket r2-teen-flow-1: the state picked on the permit finder is carried to the Get ready,
// paycheck and safety links. Plain links when the state is cleared or is "other".
// Run with: node --test tests/r2-teen-flow-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

// Every link in the main content that goes to one page, as its raw href.
function hrefsTo(document, base) {
  return [...document.querySelectorAll("main a[href]")]
    .map((a) => a.getAttribute("href"))
    .filter((h) => h.split("?")[0] === base);
}

test("permit: picking ny carries state=ny to the next-step, ready, safety and paycheck links", async () => {
  const { window, document, errors } = await loadPage("permit.html"); await tick();
  type(window, document.getElementById("pState"), "ny");
  type(window, document.getElementById("pAge"), "15");
  type(window, document.getElementById("pKind"), "job");
  await tick();
  assert.equal(document.querySelector("#next-step a").getAttribute("href"), "ready.html?state=ny");
  const ready = hrefsTo(document, "ready.html");
  assert.ok(ready.length >= 2, "the ready links are on the page");
  for (const h of ready) assert.equal(h, "ready.html?state=ny");
  const safety = hrefsTo(document, "safety.html");
  assert.ok(safety.length >= 1, "the safety link is on the page");
  for (const h of safety) assert.equal(h, "safety.html?state=ny");
  assert.ok(hrefsTo(document, "paycheck.html").includes("paycheck.html?state=ny"), "paycheck link carries ny");
  assert.deepEqual(errors, []);
});

test("permit: picking other, or clearing the state, makes the next-step links plain", async () => {
  const { window, document } = await loadPage("permit.html"); await tick();
  type(window, document.getElementById("pState"), "ny");
  await tick();
  type(window, document.getElementById("pState"), "other");
  await tick();
  assert.equal(document.querySelector("#next-step a").getAttribute("href"), "ready.html");
  for (const h of hrefsTo(document, "ready.html")) assert.equal(h, "ready.html");
  for (const h of hrefsTo(document, "safety.html")) assert.equal(h, "safety.html");
  assert.deepEqual(hrefsTo(document, "paycheck.html").filter((h) => h.includes("state=")), []);

  type(window, document.getElementById("pState"), "ga");
  await tick();
  assert.equal(document.querySelector("#next-step a").getAttribute("href"), "ready.html?state=ga");
  type(window, document.getElementById("pState"), "");
  await tick();
  assert.equal(document.querySelector("#next-step a").getAttribute("href"), "ready.html");
  for (const h of hrefsTo(document, "safety.html")) assert.equal(h, "safety.html");
});

test("permit: paycheck link carries the state only for ca, ga, ny and il", async () => {
  const { window, document } = await loadPage("permit.html"); await tick();
  // The finder has no paycheck link outside the answer card, so add one to the content to test the rule.
  const extra = document.createElement("a");
  extra.setAttribute("href", "paycheck.html");
  extra.textContent = "Your first paycheck";
  document.querySelector("main").appendChild(extra);
  type(window, document.getElementById("pState"), "tx");
  await tick();
  assert.equal(extra.getAttribute("href"), "paycheck.html", "tx is not one of the four states");
  type(window, document.getElementById("pState"), "il");
  await tick();
  assert.equal(extra.getAttribute("href"), "paycheck.html?state=il");
});
