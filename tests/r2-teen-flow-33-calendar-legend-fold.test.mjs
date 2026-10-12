// Ticket r2-teen-flow-4 (calendar): the "What the words mean" legend is a closed details box, so the results
// sit higher on a phone. The four list items keep their text, and beforeprint still opens the box.
// Run with: node --test tests/r2-teen-flow-33-calendar-legend-fold.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("calendar legend: is a closed details box whose summary reads 'What the words mean'", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  const { document } = p;
  const legend = document.getElementById("calLegend");
  assert.ok(legend, "the legend exists");
  assert.equal(legend.tagName, "DETAILS");
  assert.equal(legend.hasAttribute("open"), false, "the legend is closed by default");
  assert.equal(legend.querySelector(":scope > summary").textContent.trim(), "What the words mean");
  assert.equal(legend.previousElementSibling, document.getElementById("cCount"), "the legend sits right after the count");
  assert.equal(legend.nextElementSibling, document.getElementById("hClose"), "the legend sits right before the deadlines heading");
  assert.deepEqual(p.errors, []);
});

test("calendar legend: the four list items keep their text", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  const legend = p.document.getElementById("calLegend");
  const items = [...legend.querySelectorAll("li")].map((li) => li.textContent.replace(/\s+/g, " ").trim());
  assert.equal(items.length, 4);
  assert.match(items[0], /^Applications open: the program takes applications in the month you picked\.$/);
  assert.match(items[1], /^Deadlines this month: the program's last day to apply is in the month you picked\.$/);
  assert.match(items[2], /^Number on a month button: how many programs match your place and age in that month\.$/);
  assert.match(items[3], /^Official page: opens the program's own website in a new tab\.$/);
});

test("calendar legend: beforeprint opens it and afterprint closes it again", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  const legend = p.document.getElementById("calLegend");
  assert.equal(legend.hasAttribute("open"), false);
  p.window.dispatchEvent(new p.window.Event("beforeprint"));
  assert.equal(legend.hasAttribute("open"), true, "print opens the legend");
  p.window.dispatchEvent(new p.window.Event("afterprint"));
  assert.equal(legend.hasAttribute("open"), false, "afterprint puts it back closed");
});

test("calendar legend: the built page has the closed details box and no old div", () => {
  const html = read("calendar.html");
  assert.match(html, /<details[^>]*id="calLegend"/);
  assert.doesNotMatch(html, /<div[^>]*id="calLegend"/);
  assert.doesNotMatch(html, /<details[^>]*id="calLegend"[^>]*\sopen[\s>=]/);
});
