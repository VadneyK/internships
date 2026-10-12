// Ticket p6-farm-1: farm and ranch box on the Safety page, built only from the farm rules in data/employers.json,
// and a one line link to it from the Jobs page.
// Run with: node --test tests/p6-farm-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const read = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url)));
const rules = read("data/employers.json").rules;
const FARM_IDS = ["dol-farm-work-youth", "dol-farm-12-13", "dol-farm-under-12", "us-hired-farm-work-youth-rules"];
const ruleById = (id) => rules.find((r) => r.id === id);
// Short visible link text per rule. The full page_title stays in data/employers.json.
const LINK_TEXT = {
  "dol-farm-12-13": "Agricultural Jobs - 12-13",
  "dol-farm-under-12": "Agricultural Jobs - Under 12",
  "dol-farm-work-youth": "DOL Fact Sheet #40",
};

test("the four farm rules exist in data/employers.json with a url and page_title", () => {
  for (const id of FARM_IDS) {
    const r = ruleById(id);
    assert.ok(r, id + " missing");
    assert.match(r.url, /^https:\/\/www\.(dol|osha)\.gov\//, id);
    assert.ok(r.page_title && r.page_title.length > 0, id + " lacks page_title");
  }
});

test("safety page has a labelled farm box with the required lead line", async () => {
  const { document } = await loadPage("safety.html"); await tick(200);
  const box = document.getElementById("farm-box");
  assert.ok(box, "farm-box missing");
  assert.equal(box.querySelector("h3").textContent, "On a farm or ranch");
  assert.equal(box.getAttribute("role"), "group", "farm box needs a role so its label is announced");
  assert.ok(box.textContent.includes("These farm rules are different from the non-farm lists on this page."));
  assert.ok(document.getElementById("sec-hazards").contains(box), "box should sit in the hazards part");
});

test("every farm statement carries a source link that matches its data rule (url and page_title)", async () => {
  const { document } = await loadPage("safety.html"); await tick(200);
  const items = [...document.querySelectorAll("#farm-box li[data-rule]")];
  assert.equal(items.length, 4, "expected four farm statements");
  const covered = new Set();
  for (const li of items) {
    const id = li.getAttribute("data-rule");
    assert.ok(FARM_IDS.includes(id), id + " is not a farm rule in the data");
    covered.add(id);
    const r = ruleById(id);
    const a = li.querySelector("a[href]");
    assert.ok(a, id + " statement has no source link");
    assert.equal(a.getAttribute("href"), r.url, id + " link url");
    assert.equal(a.textContent.trim(), LINK_TEXT[id], id + " link text");
    assert.ok(a.textContent.trim().length <= 40, id + " link text too long");
  }
  assert.ok(covered.has("dol-farm-12-13") && covered.has("dol-farm-work-youth") && covered.has("dol-farm-under-12"));
});

test("the farm statements cover ages 12 and 13, 14 and 15, under 12, and the parent-owned farm exception", async () => {
  const { document } = await loadPage("safety.html"); await tick(200);
  const text = [...document.querySelectorAll("#farm-box li")].map((li) => li.textContent).join("\n");
  assert.match(text, /Ages 12 and 13:[\s\S]*written permission/);
  assert.match(text, /Ages 14 and 15:[\s\S]*outside school hours/);
  assert.match(text, /Under 12:[\s\S]*exempt from the federal minimum wage/);
  assert.match(text, /A parent's own farm:[\s\S]*children of any age/);
});

test("the farm box uses no em dash or en dash", async () => {
  const { document } = await loadPage("safety.html"); await tick(200);
  const t = document.getElementById("farm-box").textContent;
  assert.ok(!/[\u2013\u2014]/.test(t));
});

test("jobs page has one line link to the farm box", async () => {
  const { document } = await loadPage("jobs.html"); await tick(200);
  const link = document.querySelector('#jFarmLink a[href="safety.html#farm-box"]');
  assert.ok(link, "link to safety.html#farm-box missing");
  assert.equal(document.querySelectorAll("#jFarmLink").length, 1);
});
