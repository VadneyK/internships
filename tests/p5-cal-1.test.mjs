// Ticket p5-cal-1 (calendar): plain words for the status words, "application round" instead of "cycle",
// and one last-checked date that comes from data/meta.json.
// Run with: node --test tests/p5-cal-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const META = JSON.parse(read("data/meta.json"));

test("calendar: the page says application round, not cycle, in its own text", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  const { document } = p;
  const desc = document.querySelector('meta[name="description"]').getAttribute("content");
  for (const text of [desc, document.getElementById("calNote").textContent, document.getElementById("cOpenNote").textContent, document.getElementById("calLegend").textContent]) {
    assert.doesNotMatch(text, /\bcycle\b/i);
  }
  assert.match(desc, /last application round/);
  assert.match(document.getElementById("cOpenNote").textContent, /last application round/);
  assert.match(document.getElementById("calNote").textContent, /last application round/);
  assert.doesNotMatch(read("src/calendar.html"), /\bcycle\b/i);
  assert.doesNotMatch(read("data/calendar.json"), /"note": "[^"]*\bcycle\b/i);
});

test("calendar legend: sits under the count, explains the status words in plain words", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  const { document } = p;
  const legend = document.getElementById("calLegend");
  assert.ok(legend, "the legend exists");
  assert.equal(legend.querySelector(":scope > summary").textContent.trim(), "What the words mean");
  assert.equal(legend.previousElementSibling, document.getElementById("cCount"), "the legend sits right after the count");
  const items = [...legend.querySelectorAll("li")].map((li) => li.textContent.replace(/\s+/g, " ").trim());
  assert.equal(items.length, 4);
  assert.match(items[0], /^Applications open: the program takes applications in the month you picked\.$/);
  assert.match(items[1], /^Deadlines this month: the program's last day to apply is in the month you picked\.$/);
  assert.match(items[2], /^Number on a month button: /);
  assert.match(items[3], /^Official page: /);
  // The status words named in the legend are the headings the page really shows.
  assert.equal(document.getElementById("hOpen").textContent.trim(), "Applications open");
  assert.equal(document.getElementById("hClose").textContent.trim(), "Deadlines this month");
});

test("calendar: the legend is visible in the page and has no long dashes", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  assert.equal(p.document.getElementById("calLegend").hidden, false);
  assert.deepEqual(p.errors, []);
  for (const file of ["src/calendar.html", "calendar.html", "tests/p5-cal-1.test.mjs"]) {
    assert.equal(new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]").test(read(file)), false, file + " has no en or em dash");
  }
});

test("calendar: one last-checked date, taken from data/meta.json", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  const { document } = p;
  const stamps = [...document.querySelectorAll("body *")]
    .filter((el) => el.children.length === 0 && /Last checked/.test(el.textContent))
    .map((el) => el.textContent.replace(/\s+/g, " ").trim());
  assert.ok(stamps.length >= 1, "the footer shows a last-checked date");
  for (const s of stamps) assert.match(s, new RegExp("Last checked " + META.checked_label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\."));
  assert.doesNotMatch(document.body.textContent, /Last read/);
  assert.doesNotMatch(document.body.textContent, /\bOct 9, 2026\b/);
});

test("calendar: the built page carries the same single date and no old wording", () => {
  const html = read("calendar.html");
  assert.doesNotMatch(html, /Last read/);
  assert.doesNotMatch(html, /\bOct 9, 2026\b/);
  const label = META.checked_label;
  const found = [...html.matchAll(/Last checked ([A-Z][a-z]{2} \d{1,2}, \d{4})/g)].map((m) => m[1]);
  assert.ok(found.length >= 1);
  assert.deepEqual([...new Set(found)], [label]);
  assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ""), /\bcycle\b/i);
});
