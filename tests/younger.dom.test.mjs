import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("younger: loads clean, shows the four state grid with sources and calls, safety, sites with ages, and the path to a first job", async () => {
  const p = await loadPage("younger.html"); await tick(200);
  const { document } = p;
  assert.deepEqual(p.errors, []);
  assert.equal(document.querySelectorAll("#gridT thead th").length, 5);
  assert.equal(document.querySelectorAll("#gridT tbody tr").length, 7, "six jobs plus who to ask");
  assert.match(document.getElementById("gridT").textContent, /babysitter must be at least 14/);
  assert.match(document.getElementById("gridT").textContent, /877-709-8185/);
  assert.match(document.getElementById("strangers").textContent, /public place/);
  assert.match(document.getElementById("sitesT").textContent, /Care\.com/);
  assert.match(document.getElementById("conflicts").textContent, /Georgia/);
  assert.ok(Number(document.getElementById("n13").textContent) > 20, "count of programs that take 13 year olds");
  for (const a of document.querySelectorAll("#gridT a, #train a, #groups a, #sitesT a")) assert.match(a.href, /^https:\/\//);
  assert.doesNotMatch(document.body.textContent, /undefined|NaN/);
});

test("younger: sits under Get ready in the nav", async () => {
  const { document } = await loadPage("younger.html"); await tick(100);
  assert.match(document.querySelector('nav a[aria-current="page"]').textContent, /Get ready/);
});
