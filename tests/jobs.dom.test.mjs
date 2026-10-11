import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick, type } from "./dom-helper.mjs";
const d = JSON.parse(fs.readFileSync(new URL("../data/employers.json", import.meta.url)));

test("employers.json: every entry has a https page, a quote under 15 words, an age 11 to 18, and a known group", () => {
  const groups = new Set(d.groups.map((g) => g[0])), ids = new Set();
  assert.ok(d.employers.length >= 40);
  for (const e of d.employers) {
    assert.ok(!ids.has(e.id), "duplicate " + e.id); ids.add(e.id);
    assert.match(e.url, /^https:\/\//, e.id);
    assert.ok(e.quote.split(/\s+/).length <= 15, e.id + " quote is too long");
    assert.ok(Number.isInteger(e.min_age) && e.min_age >= 11 && e.min_age <= 18, e.id + " age");
    assert.ok(groups.has(e.group), e.id + " group");
    for (const k of ["name", "kind", "age_note", "roles", "how_to_apply", "page_title"]) assert.ok(e[k] && e[k].trim(), e.id + " " + k);
  }
  for (const r of d.rules) assert.match(r.url, /^https:\/\//, r.id);
  assert.doesNotMatch(JSON.stringify(d), /[\u2013\u2014]|&amp;|&#/);
});

test("jobs: tapping an age shows only employers that start at or under it, older ones are folded away, links are safe", async () => {
  const { window, document, errors } = await loadPage("jobs.html"); await tick(150);
  assert.equal(document.querySelectorAll("#jAge + .tp .tile").length, 6);
  type(window, document.getElementById("jAge"), "14");
  const shown = [...document.querySelectorAll("#jOut > .grid .card h3")].map((h) => h.textContent);
  const want = d.employers.filter((e) => e.min_age <= 14).map((e) => e.name);
  assert.deepEqual(shown.sort(), want.sort());
  assert.ok(document.querySelector("#jOut details"), "older employers are in a details");
  type(window, document.getElementById("jAge"), "17");
  assert.equal(document.querySelectorAll("#jOut > .grid .card").length, d.employers.filter((e) => e.min_age <= 17).length);
  for (const a of document.querySelectorAll("#jOut a, #jRules a")) { assert.match(a.getAttribute("rel"), /noopener/); assert.match(a.href, /^https:\/\//); }
  assert.equal(document.getElementById("jStatus").textContent.includes("age 17"), true);
  assert.deepEqual(errors, []);
});

test("jobs: under 14 gets the federal rule and the ages 12 to 14 page, not a list of employers; the rules always show", async () => {
  const { window, document } = await loadPage("jobs.html?age=u14"); await tick(150);
  assert.match(document.getElementById("jOut").textContent, /under 14/i);
  assert.ok(document.querySelector('#jOut a[href="younger.html"]'));
  assert.equal(document.querySelectorAll("#jRules .card").length, d.rules.length);
});
