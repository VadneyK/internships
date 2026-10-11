// Ticket r2-jobs-1: BC is not matched by US-wide entries, BC rules lead, under 14 cards, age 18 line.
// Run with: node --test tests/r2-teen-flow-12-jobs.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick, type } from "./dom-helper.mjs";
const read = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url)));
const d = read("data/employers.json"), y = read("data/younger.json");

test("BC: no US-wide entries, province label, Canada line", async () => {
  const { window, document, errors } = await loadPage("jobs.html?age=16&state=BC"); await tick(250);
  const shown = [...document.querySelectorAll("#jOut .card h3")].map((h) => h.textContent).sort();
  const want = d.employers.filter((e) => e.min_age <= 16 && e.where.includes("BC")).map((e) => e.name).sort();
  assert.deepEqual(shown, want);
  assert.ok(!d.employers.some((e) => e.where.includes("US") && shown.includes(e.name)));
  assert.equal(document.querySelector('label[for="jState"]').textContent, "Where do you live? (state or province)");
  assert.match(document.getElementById("jHours").textContent, /British Columbia has its own rules\. See the BC cards below\./);
  assert.doesNotMatch(document.getElementById("jHours").textContent, /do not apply in Canada/);
  assert.deepEqual(errors, []);
});

test("BC: rules lead swaps and only bc- rules show; US states keep US rules", async () => {
  const { window, document } = await loadPage("jobs.html?age=16&state=BC"); await tick(250);
  assert.equal(document.getElementById("jRulesLead").textContent, "These are US rules. In British Columbia the rules come from the Employment Standards Branch.");
  const bc = d.rules.filter((r) => r.id.startsWith("bc-")).map((r) => r.name);
  assert.deepEqual([...document.querySelectorAll("#jRules h3")].map((h) => h.textContent), bc);
  type(window, document.getElementById("jState"), "OH");
  assert.match(document.getElementById("jRulesLead").textContent, /US Department of Labor/);
  const names = [...document.querySelectorAll("#jRules h3")].map((h) => h.textContent);
  assert.equal(names.length, d.rules.length - bc.length);
  assert.ok(!names.some((n) => bc.includes(n)));
});

test("under 14: up to six cards from younger.json with source links, then the federal note", async () => {
  const { document, errors } = await loadPage("jobs.html?age=12"); await tick(250);
  const cards = [...document.querySelectorAll("#jWays .card")];
  const items = y.near.items.slice(0, 6);
  assert.equal(cards.length, items.length);
  assert.ok(cards.length > 0 && cards.length <= 6);
  items.forEach((it, i) => {
    assert.equal(cards[i].querySelector("p").textContent, it.t);
    assert.equal(cards[i].querySelector("a").getAttribute("href"), it.s.u);
  });
  const out = document.getElementById("jOut").textContent;
  assert.match(out, /Ways to earn at 12 and 13/);
  assert.match(out, /children under 14 may not be employed/);
  assert.match(document.getElementById("jStatus").textContent, /listed below/);
  assert.deepEqual(errors, []);
});

test("under 14 in BC: no US cards and no listed below claim", async () => {
  const { document } = await loadPage("jobs.html?age=13&state=BC"); await tick(250);
  assert.equal(document.querySelectorAll("#jWays .card").length, 0);
  assert.doesNotMatch(document.getElementById("jStatus").textContent, /listed below/);
  assert.match(document.getElementById("jOut").textContent, /British Columbia/);
});

test("age 18 gets the plain intro line; 17 does not", async () => {
  const a = await loadPage("jobs.html?age=18"); await tick(250);
  assert.equal(a.document.getElementById("jAge18").textContent, "The federal limits on dangerous jobs for workers under 18 do not apply at 18. Source: US Department of Labor, Fact Sheet #43 (opens in a new tab)");
  assert.equal(a.document.querySelector("#jAge18 a").getAttribute("href"), "https://www.dol.gov/agencies/whd/fact-sheets/43-child-labor-non-agriculture");
  const b = await loadPage("jobs.html?age=17"); await tick(250);
  assert.equal(b.document.getElementById("jAge18"), null);
});
