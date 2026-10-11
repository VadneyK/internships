// Ticket r3-a11y-perf-1: the Numbers page "Where is the paid work?" chart writes the paid, free and
// costs-money counts as visible text on every row, not only as colors and mouse-only title attributes.
// Run with: node --test tests/r3-a11y-perf-1-hub-chart.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const firstInt = (s) => parseInt(String(s).match(/\d+/)[0], 10);
const countOf = (text, label) => {
  const m = text.match(new RegExp("(\\d+) " + label));
  return m ? parseInt(m[1], 10) : 0;
};

test("Numbers hub chart: every row states paid, free and costs-money counts in text that add up to the total", async () => {
  const page = await loadPage("insights.html");
  const doc = page.document;
  for (let i = 0; i < 100 && doc.querySelectorAll("#chartHubs a.crow").length === 0; i++) await tick(50);
  const rows = [...doc.querySelectorAll("#chartHubs a.crow")];
  assert.ok(rows.length >= 10, "found the area rows");

  // The same numbers the page was drawn from, so the text is checked against real data, not against itself.
  const list = await page.window.TIG.loadEntries("card");
  const hubs = page.window.TIG.lib.insights(list, Date.now()).hubs;
  assert.equal(rows.length, hubs.length, "one row per area with programs");

  rows.forEach((el, i) => {
    const h = hubs[i];
    const label = el.querySelector(".cl").textContent.trim();
    const total = firstInt(el.querySelector(".cn").textContent);
    const breakdown = el.querySelector(".cbreak").textContent;
    const tag = label + " -> " + breakdown;

    // The link's own text (its accessible name, since it has no aria-label) carries the label, total and counts.
    assert.ok(el.textContent.includes(label), tag + ": label is in the link text");
    assert.equal(total, h.n, tag + ": total");
    assert.equal(countOf(breakdown, "paid"), h.pay, tag + ": paid");
    assert.equal(countOf(breakdown, "free"), h.free, tag + ": free");
    assert.equal(countOf(breakdown, "costs money"), h.fee, tag + ": costs money");
    assert.equal(countOf(breakdown, "pay not stated"), h.unknown || 0, tag + ": pay not stated");

    const summed = h.pay + h.free + h.fee + (h.unknown || 0);
    assert.equal(summed, total, tag + ": counts sum to the total");
  });

  // No number is carried only by a title attribute (mouse-only tooltip) inside the chart.
  assert.equal(doc.querySelectorAll("#chartHubs i[title]").length, 0, "no i[title] in #chartHubs");
  assert.equal(doc.querySelectorAll("#chartHubs [title]").length, 0, "no title attribute in #chartHubs");

  // The bar segments are decoration, so they are hidden from screen readers.
  assert.equal(doc.querySelectorAll("#chartHubs .ctrack[aria-hidden='true']").length, rows.length);

  // The legend is still hidden, so its three labels must appear as visible text beside each row.
  const legend = doc.querySelector(".legend");
  if (legend.getAttribute("aria-hidden") === "true") {
    for (const word of ["paid", "free", "costs money"]) {
      assert.ok(rows.every((el) => el.querySelector(".cbreak").textContent.includes(word)), "row text has " + word);
    }
  }
  page.window.close();
});
