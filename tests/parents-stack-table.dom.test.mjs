// 2026-10-14 (persona round 9): the parents.html permit table has 4 columns and scrolled sideways on phones.
// On narrow screens it now stacks: each place is a block and every cell shows its column name above the text.
// display:block drops table meaning in some browsers, so the table, row groups, rows and cells carry ARIA roles,
// and the visible column names are aria-hidden so screen readers hear the real headers once.
// Run with: node --test tests/parents-stack-table.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

async function ready() {
  const p = await loadPage("parents.html");
  for (let i = 0; i < 80 && !p.document.querySelector("#signT tbody tr"); i++) await tick(25);
  return p;
}

test("the permit table is a stacking table with ARIA table roles", async () => {
  const { document } = await ready();
  const t = document.getElementById("signT");
  assert.ok(t.classList.contains("stackt"));
  assert.equal(t.getAttribute("role"), "table");
  for (const g of t.querySelectorAll("thead, tbody")) assert.equal(g.getAttribute("role"), "rowgroup");
  for (const r of t.querySelectorAll("tr")) assert.equal(r.getAttribute("role"), "row");
  for (const h of t.querySelectorAll("thead th")) assert.equal(h.getAttribute("role"), "columnheader");
  for (const h of t.querySelectorAll("tbody th")) assert.equal(h.getAttribute("role"), "rowheader");
  for (const c of t.querySelectorAll("td")) assert.equal(c.getAttribute("role"), "cell");
});

test("every cell's stacked label matches its column header and is hidden from screen readers", async () => {
  const { document } = await ready();
  const heads = [...document.querySelectorAll("#signT thead th")].map((h) => h.textContent.trim().toLowerCase());
  const rows = document.querySelectorAll("#signT tbody tr");
  assert.ok(rows.length > 5);
  for (const r of rows) {
    const cells = [...r.children];
    assert.equal(cells.length, heads.length);
    assert.equal(cells[0].querySelector(".tk"), null, "the place name is the block title, no label");
    cells.slice(1).forEach((c, i) => {
      const k = c.querySelector(".tk");
      assert.ok(k, "cell " + (i + 1) + " of " + cells[0].textContent + " has a label");
      assert.equal(k.textContent.trim().toLowerCase(), heads[i + 1]);
      assert.equal(k.getAttribute("aria-hidden"), "true");
      assert.equal(c.firstElementChild, k, "the label comes first in the cell");
    });
  }
});

test("the state picker redraw keeps the stacked labels", async () => {
  const { window, document } = await ready();
  const sel = document.getElementById("pState");
  sel.value = sel.options[1].value;
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  const rows = document.querySelectorAll("#signT tbody tr");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].querySelectorAll(".tk").length, 3);
});

test("the stylesheet hides the labels on wide screens and stacks the rows under 40rem", () => {
  const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");
  assert.match(css, /\.stackt \.tk \{ display: none; \}/);
  const m = css.match(/@media \(max-width: 40rem\) \{\n  \/\*[^]*?\*\/\n  table, table\.stackt \{ min-width: 0; \}[\s\S]*?\n\}/);
  assert.ok(m, "the phone block for .stackt exists");
  assert.match(m[0], /\.stackt tr, \.stackt tbody th\[scope="row"\], \.stackt td \{ display: block; \}/);
  assert.match(m[0], /\.stackt \.tk \{ display: block;/);
  assert.match(m[0], /\.stackt thead \{ position: absolute;/);
});

// 2026-10-14: "Who to call" goes through lib.js linkContacts, so a parent on a phone can tap to call,
// and tel: links never wrap mid number.
test("phone numbers in Who to call are tap-to-call links that move to a new line whole", async () => {
  const { document } = await ready();
  const calls = [...document.querySelectorAll("#signT tbody tr")].map((r) => r.children[3]);
  const withNumber = calls.filter((c) => /\d{3}-\d{3}-\d{4}/.test(c.textContent));
  assert.ok(withNumber.length >= 3);
  for (const c of withNumber) {
    const a = c.querySelector('a[href^="tel:+1"]');
    assert.ok(a, c.textContent + " has a tel link");
    assert.match(a.getAttribute("href"), /^tel:\+1\d{10}$/);
  }
  const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");
  /* 2026-10-16: inline-block, not nowrap, so a number longer than a 320 px line can still wrap (tests/r12-a11y-perf-1) */
  assert.match(css, /a\[href\^="tel:"\] \{ display: inline-block; \}/);
});

// 2026-10-14 (persona r9 item 8): the table opens on the family's state when the guide knows it.
test("?state=ca opens the permit table on California and keeps it in the address", async () => {
  const p = await loadPage("parents.html", { search: "?state=ca" });
  for (let i = 0; i < 80 && !p.document.querySelector("#signT tbody tr"); i++) await tick(25);
  assert.equal(p.document.getElementById("pState").value, "ca");
  assert.equal(p.document.querySelectorAll("#signT tbody tr").length, 1);
  assert.equal(p.document.querySelector("#signT tbody th").textContent, "California");
});

test("a place saved on Programs picks its state; an unknown or multi-state place keeps all places", async () => {
  for (const [place, want] of [["city:atlanta", "ga"], ["area:bay-area", "ca"], ["area:midwest", ""], ["nowhere", ""]]) {
    const p = await loadPage("parents.html", { storage: { findprefs: { place } } });
    for (let i = 0; i < 80 && !p.document.querySelector("#signT tbody tr"); i++) await tick(25);
    assert.equal(p.document.getElementById("pState").value, want, place);
    assert.equal(p.document.querySelectorAll("#signT tbody tr").length > 1, want === "", place);
  }
});

test("the address state wins over the saved place, and a bad address state falls back to the saved place", async () => {
  let p = await loadPage("parents.html", { search: "?state=ny", storage: { findprefs: { place: "city:atlanta" } } });
  for (let i = 0; i < 80 && !p.document.querySelector("#signT tbody tr"); i++) await tick(25);
  assert.equal(p.document.getElementById("pState").value, "ny");
  p = await loadPage("parents.html", { search: "?state=zz", storage: { findprefs: { place: "city:atlanta" } } });
  for (let i = 0; i < 80 && !p.document.querySelector("#signT tbody tr"); i++) await tick(25);
  assert.equal(p.document.getElementById("pState").value, "ga");
});

test("picking a place writes state= into the address; All places removes it", async () => {
  const { window, document } = await ready();
  const sel = document.getElementById("pState");
  sel.value = "il"; sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(new URLSearchParams(window.location.search).get("state"), "il");
  sel.value = ""; sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(new URLSearchParams(window.location.search).get("state"), null);
});
