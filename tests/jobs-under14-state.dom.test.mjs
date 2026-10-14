// Persona round 9 (2026-10-14, a Fremont parent of a 13 year old): the Jobs page for 12 and 13 in California shows California's own
// hour rule, gives New York only as an example of a stricter state, and links the Bay Area and Sacramento ride table.
// Run with: node --test tests/jobs-under14-state.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("jobs.html?age=13&state=ca: California hours at 12 and 13, New York as an example, Bay Area rides", async () => {
  const { document, errors } = await loadPage("jobs.html", { search: "?age=13&state=ca" });
  for (let i = 0; i < 80 && !(document.getElementById("jHours12") && document.getElementById("jWays")); i++) await tick(50);
  const h = document.getElementById("jHours12");
  assert.ok(h, "the California rule for 12 and 13 is shown");
  assert.match(h.textContent, /Hours at 12 and 13 in California: School days: no work\./);
  assert.ok(h.querySelector('a[href="tel:+18335264636"]'), "the Labor Commissioner number can be tapped");
  assert.ok(h.querySelector('a[href="permit.html?state=ca&age=13"]'));
  const ways = document.getElementById("jWays").textContent;
  assert.match(ways, /For example, New York says a babysitter must be at least 14\./);
  assert.doesNotMatch(ways, /stricter: New York/);
  assert.ok(document.querySelector('#jHelp a[href="ready.html?ride=bay"]'), "California ride help links the Bay Area and Sacramento table");
  assert.deepEqual(errors, []);
});

test("U14_HOURS in jobs.js lists exactly the US states with an hours rule for 12 in permits.json", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../assets/js/jobs.js", import.meta.url), "utf8");
  const listed = JSON.parse(src.match(/var U14_HOURS = (\[[^\]]*\]);/)[1]);
  const p = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8")).states;
  const want = Object.keys(p).filter((k) => k !== "bc" && p[k].hours && p[k].hours["12"]).sort();
  assert.deepEqual(listed.slice().sort(), want);
});
