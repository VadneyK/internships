// Ticket p7-wages-1: state minimum wage on the Jobs hours strip and the permit short card.
// Run with: node --test tests/p7-wages-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";
const w = JSON.parse(fs.readFileSync(new URL("../data/state-wages.json", import.meta.url), "utf8"));
const lite = JSON.parse(fs.readFileSync(new URL("../data/states-lite.json", import.meta.url), "utf8"));
const DASH = new RegExp("[\\u2013\\u2014]");

test("state-wages.json has all 50 states and DC, https urls, short quotes, no dashes", () => {
  assert.equal(w.states.length, 51);
  const ids = new Set(w.states.map((s) => s.id));
  assert.equal(ids.size, 51);
  assert.ok(ids.has("dc") && ids.has("co") && ids.has("ca"));
  for (const s of w.states) {
    assert.match(s.url, /^https:\/\//, s.id);
    assert.ok(s.wage && s.page_title && s.quote, s.id);
    assert.ok(s.quote.split(/\s+/).length < 40, s.id + " quote too long");
  }
  assert.ok(!DASH.test(JSON.stringify(w)), "dash character in state-wages.json");
});

test("jobs hours strip shows the Colorado wage for CO and fetches the file only after a state is picked", async () => {
  const bareLog = [];
  await loadPage("jobs.html", { fetchLog: bareLog }); await tick(200);
  assert.equal(bareLog.filter((r) => /state-wages\.json/.test(r.url)).length, 0, "wages fetched on a bare jobs.html");
  const log = [];
  const { document } = await loadPage("jobs.html?age=16&state=CO", { fetchLog: log }); await tick(300);
  const box = document.getElementById("jHoursBox");
  assert.ok(box, "no hours box");
  assert.match(box.textContent, /State minimum wage: \$15\.16 an hour\./);
  assert.match(box.textContent, /Some cities may set a higher rate\. Check your city\./);
  const a = box.querySelector(".stateWage a");
  assert.ok(a && /^https:/.test(a.href));
  assert.equal(log.filter((r) => /state-wages\.json/.test(r.url)).length, 1, "wages not fetched exactly once after a state is picked");
});

test("permit page reads the wages only after a short-answer state is picked", async () => {
  const bareLog = [];
  await loadPage("permit.html", { fetchLog: bareLog }); await tick(200);
  assert.equal(bareLog.filter((r) => /state-wages\.json/.test(r.url)).length, 0, "wages fetched on a bare permit.html");
});

test("permit short card shows the wage line", async () => {
  const id = lite.states.find((s) => s.id === "ut") ? "ut" : lite.states[0].id;
  const log = [];
  const { document } = await loadPage("permit.html?state=" + id + "&age=16&kind=job", { fetchLog: log }); await tick(400);
  assert.equal(log.filter((r) => /state-wages\.json/.test(r.url)).length, 1, "wages not fetched exactly once for a short-answer state");
  const card = document.getElementById("pLiteCard");
  assert.ok(card, "no short card");
  const row = w.states.find((s) => s.id === id);
  assert.ok(card.textContent.includes("State minimum wage: " + row.wage));
  assert.match(card.textContent, /Some cities may set a higher rate\. Check your city\./);
});
