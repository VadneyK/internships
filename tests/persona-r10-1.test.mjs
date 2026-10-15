// Persona round 10 (2026-10-15: a Fresno mother of a 13 year old, a Chicago youth pastor with 25 teens, a Houston 16 year old).
// Run with: node --test tests/persona-r10-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("the California babysitting and yard work cells give the chart's hours for 12 and 13", () => {
  const y = JSON.parse(read("data/younger.json"));
  for (const job of ["Babysitting", "Yard work for a neighbor"]) {
    const t = y.rows.find((r) => r.job === job).cells.ca.t;
    assert.match(t, /no work on school days, up to 8 hours on a non-school day, and 7 a\.m\. to 7 p\.m\. \(9 p\.m\. from June 1 to Labor Day\)/, job);
    assert.ok(t.includes("833-526-4636"));
  }
});

test("younger.html opens with a short, sourced answer for parents", () => {
  const html = read("younger.html");
  assert.match(html, /<p id="yShort"><b>Short answer:<\/b> at 12 and 13 you can usually babysit/);
  assert.match(html, /non-ag-under-14/);
});

test("typing a town that is not a place offers a program search for it", async () => {
  const { window, document } = await loadPage("find.html");
  for (let i = 0; i < 60 && document.getElementById("place").options.length < 2; i++) await tick(50);
  const q = document.querySelector('input[role="combobox"]');
  q.value = "Fresno"; q.dispatchEvent(new window.Event("input", { bubbles: true }));
  await tick(30);
  const note = document.getElementById("placeNone");
  assert.match(note.textContent, /No place called .Fresno. yet\. Pick its state below, or search programs for .Fresno.\./);
  assert.equal(note.querySelector("a").getAttribute("href"), "find.html?q=Fresno");
});

test("the table plan says how to run a bigger group", () => {
  assert.match(read("handout.html"), /Bigger group, like 25\? Split it into tables of 4 to 8, with one adult at each table\./);
});
