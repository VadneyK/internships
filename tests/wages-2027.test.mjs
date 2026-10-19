// Issue 7: 2027 minimum wages. data/wages-2027.json is the read record (one row per state or city, each from an official page);
// money.json carries a copy of its presets so the paycheck page swaps a preset to the 2027 rate on the effective date with no extra fetch.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, waitFor } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = JSON.parse(fs.readFileSync(path.join(ROOT, "data/wages-2027.json"), "utf8"));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, "data/money.json"), "utf8"));

test("every 2027 wage row names an official page, quotes it and dates the change", () => {
  assert.ok(W.rows.length >= 15, "rows for the states and cities the guide covers");
  const ids = new Set();
  for (const r of W.rows) {
    assert.ok(!ids.has(r.id), "duplicate id " + r.id); ids.add(r.id);
    assert.match(r.url, /^https:\/\/[a-z0-9.-]+\.(gov|ca|org)\b/i, r.id + " url is an official site: " + r.url);
    assert.ok(r.quote && r.quote.length > 10, r.id + " quotes the page");
    assert.ok(r.page_title, r.id + " has a page title");
    assert.match(r.effective, /^2027-\d\d-\d\d$/, r.id + " effective date is a 2027 ISO date");
    assert.equal(typeof r.wage_2026, "number", r.id + " has a 2026 number");
    assert.ok(r.wage_2027 === null || typeof r.wage_2027 === "number", r.id + " 2027 wage is a number or null");
    if (r.wage_2027 === null) assert.ok(r.status, r.id + " says why no 2027 figure");
    for (const k of ["quote", "status", "youth", "name"]) if (r[k]) assert.doesNotMatch(r[k], /[\u2013\u2014]/, r.id + " " + k + " has a dash");
  }
  assert.ok(ids.has("ca") && ids.has("wa") && ids.has("ny") && ids.has("bc") && ids.has("palo-alto"), "the main rows are there");
});

test("money.json carries the same 2027 presets as wages-2027.json, and each names a preset the paycheck page has", () => {
  assert.deepEqual(M.w2027, W.presets);
  const presetIds = new Set(M.presets.map((p) => p.id));
  for (const [id, o] of Object.entries(W.presets)) {
    assert.ok(presetIds.has(id), id + " is a paycheck preset");
    assert.equal(typeof o.wage, "number"); assert.match(o.from, /^2027-\d\d-\d\d$/);
    const row = W.rows.find((r) => r.id === id);
    assert.ok(row && row.wage_2027 === o.wage && row.effective === o.from, id + " preset matches its row");
    assert.ok(o.label.includes("2027") && o.label.includes(o.wage.toFixed(2)), id + " label says 2027 and the rate");
  }
});

const ready = (document) => waitFor(() => document.querySelectorAll("#mPreset option").length > 1);

test("paycheck: before Jan 1, 2027 the California preset shows the 2026 rate", async () => {
  const { document } = await loadPage("paycheck.html", { now: Date.UTC(2026, 11, 31, 20) });
  await ready(document);
  const opt = document.querySelector('#mPreset option[value="ca"]');
  assert.match(opt.textContent, /2026 minimum \(\$16\.90\)/);
  document.getElementById("mPreset").value = "ca";
  document.getElementById("mPreset").dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
  assert.equal(document.getElementById("mWage").value, "16.90");
});

test("paycheck: from Jan 1, 2027 the California preset shows the 2027 rate, with no extra data fetch", async () => {
  const seen = [];
  const { document } = await loadPage("paycheck.html", { now: Date.UTC(2027, 0, 1, 12), fetchLog: seen });
  await ready(document);
  const opt = document.querySelector('#mPreset option[value="ca"]');
  assert.match(opt.textContent, /2027 minimum \(\$17\.40\)/);
  document.getElementById("mPreset").value = "ca";
  document.getElementById("mPreset").dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
  assert.equal(document.getElementById("mWage").value, "17.40");
  assert.ok(!seen.some((r) => /wages-2027/.test(r.url)), "the page reads money.json only");
});
