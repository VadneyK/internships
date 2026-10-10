// Programs page render path: filter and sort once, and Show more only appends.
// Spies on lib.sortList, lib.matches and localStorage.getItem("saved") from before any page script runs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadPage, type, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const LITE = JSON.parse(fs.readFileSync(new URL("../data/entries-lite.json", import.meta.url), "utf8"));
const NOW = new Date(2026, 9, 10, 12).getTime();
const PAGE = 60;

function spies(w) {
  const calls = { sort: 0, match: 0, saved: 0, scrolled: [] };
  w.__calls = calls;
  let lib;
  w.TIG = {};
  Object.defineProperty(w.TIG, "lib", {
    configurable: true, enumerable: true,
    get() { return lib; },
    set(v) {
      lib = v;
      const sort = v.sortList, match = v.matches;
      v.sortList = function () { calls.sort++; return sort.apply(this, arguments); };
      v.matches = function () { calls.match++; return match.apply(this, arguments); };
    },
  });
  const get = w.Storage.prototype.getItem;
  w.Storage.prototype.getItem = function (k) { if (k === "saved") calls.saved++; return get.apply(this, arguments); };
  // the helper sets scrollIntoView after setup, so record calls through an accessor that ignores that assignment
  Object.defineProperty(w.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    get() { const el = this; return function () { calls.scrolled.push(el.id); }; },
    set() {},
  });
}
const reset = (w) => { w.__calls.sort = 0; w.__calls.match = 0; w.__calls.saved = 0; };
const cards = (d) => [...d.querySelectorAll("#out article.prog")];
// the first draw can take longer than the helper's short wait when many test files run at once
async function load(search = "", storage = {}) {
  const p = await loadPage("find.html", { search, storage, setup: spies, now: NOW });
  for (let i = 0; i < 100 && !cards(p.document).length; i++) await tick(50);
  await tick(50);
  return p;
}

async function detailReady(document) {
  cards(document)[0].querySelector("details").open = true;
  for (let i = 0; i < 60 && document.querySelector("#out dl[data-detail]"); i++) await tick(50);
  assert.equal(document.querySelector("#out dl[data-detail]"), null, "detail text should have loaded");
}

test("1: a plain load sorts the list at most once", async () => {
  const { window, document, errors } = await load();
  assert.equal(cards(document).length, PAGE);
  assert.ok(window.__calls.sort >= 1 && window.__calls.sort <= 1, "sortList calls: " + window.__calls.sort);
  assert.deepEqual(errors, []);
});

test("2: a place with fewer than 3 real matches sorts once and keeps its note", async () => {
  const real = LITE.filter((e) => L.matches(e, { place: "city:ann-arbor", types: ["research"] }, NOW));
  assert.ok(real.length > 0 && real.length < 3, "fixture: Ann Arbor research has " + real.length + " real matches");
  const { window, document } = await load("?at=city:ann-arbor&kind=research");
  assert.ok(window.__calls.sort <= 1, "sortList calls: " + window.__calls.sort);
  const note = document.getElementById("placeNote");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, new RegExp("^Only " + real.length + " program" + (real.length === 1 ? "" : "s") + " found in Ann Arbor so far, so online and national programs are included too\\."));
  const wide = LITE.filter((e) => L.matches(e, { place: "city:ann-arbor", types: ["research"], placeOnline: true }, NOW));
  assert.equal(document.getElementById("count").textContent, wide.length + " of " + LITE.length + " programs");
});

test("3: a #p- link beyond the first page sorts once and opens that card", async () => {
  const id = L.sortList(LITE, "best", NOW)[100].id;
  const { window, document } = await load("#p-" + id);
  assert.ok(window.__calls.sort <= 1, "sortList calls in total: " + window.__calls.sort);
  const el = document.getElementById("p-" + id);
  assert.ok(el, "the linked card is drawn");
  assert.equal(el.querySelector("details").open, true, "the card is opened");
  assert.ok(window.__calls.scrolled.includes("p-" + id), "the card is scrolled to");
  assert.equal(cards(document).length, 101);
});

test("4: Show more appends: no sort, no filter, same nodes, open cards stay open, focus on the first new card", async () => {
  const { window, document, errors } = await load();
  const before = cards(document);
  assert.equal(before.length, PAGE);
  const det = before[3].querySelector("details"); det.open = true;
  await tick(50);
  reset(window);
  const more = document.getElementById("more"); more.focus(); more.click();
  await tick(30);
  assert.equal(window.__calls.sort, 0, "sortList calls");
  assert.equal(window.__calls.match, 0, "matches calls");
  const after = cards(document);
  assert.equal(after.length, PAGE * 2);
  before.forEach((n, i) => assert.ok(after[i] === n, "card " + i + " is the same DOM node"));
  assert.equal(det.open, true, "the card opened before the click is still open");
  assert.equal(document.activeElement, after[PAGE], "focus lands on the first new card");
  assert.match(document.getElementById("toast").textContent, new RegExp("Showing " + PAGE + " more programs"));
  assert.equal(document.querySelectorAll("#out .pager").length, 1, "one pager");
  // keep going to the end: still no sorting, every program drawn once
  while (document.getElementById("more")) document.getElementById("more").click();
  assert.equal(window.__calls.sort, 0);
  assert.equal(new Set(cards(document).map((c) => c.id)).size, LITE.length);
  assert.deepEqual(errors, []);
});

test("5: one filter change reads the saved list at most twice", async () => {
  const { window, document } = await load("", { saved: [LITE[5].id, LITE[9].id] });
  reset(window);
  document.getElementById("onlyVerified").click();
  await tick(30);
  assert.ok(window.__calls.saved <= 2, "localStorage.getItem('saved') calls: " + window.__calls.saved);
  assert.equal(window.__calls.sort, 1);
  assert.equal(document.querySelectorAll("#out .star[aria-pressed=true]").length <= 2, true);
});

test("6: typing summer as 6 quick input events is one filter pass", async () => {
  const { window, document } = await load();
  await detailReady(document);
  reset(window);
  const q = document.getElementById("q");
  for (const v of ["s", "su", "sum", "summ", "summe", "summer"]) { q.value = v; q.dispatchEvent(new window.Event("input", { bubbles: true })); await tick(10); }
  await tick(400);
  assert.equal(window.__calls.match, LITE.length, "matches calls");
  assert.ok(window.__calls.sort <= 1);
  assert.match(window.location.search, /q=summer/);
});

test("the Cards and Dates switch and a See card jump reuse the list", async () => {
  const { window, document } = await load();
  reset(window);
  document.getElementById("viewDates").click(); await tick(30);
  assert.equal(document.getElementById("dates").hidden, false);
  const jump = document.querySelector("#dates [data-jump]");
  assert.ok(jump);
  jump.click(); await tick(30);
  document.getElementById("viewCards").click(); await tick(30);
  assert.equal(window.__calls.sort, 0, "sortList calls");
  assert.equal(window.__calls.match, 0, "matches calls");
  assert.ok(document.getElementById("p-" + jump.getAttribute("data-jump")), "the jumped-to card is drawn");
});
