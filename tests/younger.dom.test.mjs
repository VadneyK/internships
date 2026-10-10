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

test("younger: the CA and GA volunteering cells give an answer, not Not stated, and keep their sources", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  const row = [...document.querySelectorAll("#gridT tbody tr")].find((r) => r.querySelector("th")?.textContent === "Volunteering");
  assert.ok(row, "Volunteering row is on the grid");
  const [ca, ga, ny] = row.querySelectorAll("td");
  assert.doesNotMatch(ca.textContent, /Not stated/);
  assert.doesNotMatch(ga.textContent, /Not stated/);
  assert.match(ca.textContent, /No permit for true unpaid volunteering/);
  assert.match(ca.textContent, /5 CCR 10121/);
  assert.match(ca.querySelector("a").href, /law\.cornell\.edu/);
  assert.match(ga.textContent, /No permit for unpaid volunteering/);
  assert.match(ga.querySelector("a").href, /dol\.georgia\.gov/);
  assert.match(ny.textContent, /Queens/, "New York cell unchanged");
});

test("younger: sits under Get ready in the nav", async () => {
  const { document } = await loadPage("younger.html"); await tick(100);
  assert.match(document.querySelector('nav a[aria-current="page"]').textContent, /Get ready/);
});
