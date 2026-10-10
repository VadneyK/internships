import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("ready: loads with no errors and shows an 8 item checklist", async () => {
  const { document, errors } = await loadPage("ready.html");
  assert.deepEqual(errors, []);
  assert.equal(document.querySelectorAll("#readyList input[type=checkbox]").length, 8);
  assert.equal(document.getElementById("readySum").textContent, "0 of 8 done");
});

test("ready: checking items updates the count, is remembered, and Start over clears it", async () => {
  const a = await loadPage("ready.html");
  for (const i of [0, 3]) { // the list is repainted after each change, so look the box up again every time
    const box = a.document.querySelectorAll("#readyList input")[i];
    box.checked = true; box.dispatchEvent(new a.window.Event("change", { bubbles: true }));
  }
  assert.equal(a.document.getElementById("readySum").textContent, "2 of 8 done");
  const b = await loadPage("ready.html", { storage: { ready: { job: true, docs: true } } });
  assert.equal(b.document.getElementById("readySum").textContent, "2 of 8 done");
  b.document.getElementById("readyReset").click();
  assert.equal(b.document.getElementById("readySum").textContent, "0 of 8 done");
});

test("ready: each district shows steps and a link to the page we read; others get the general advice", async () => {
  const { window, document } = await loadPage("ready.html");
  const sel = document.getElementById("dist");
  for (const v of ["davis", "oakland", "sf", "sj"]) {
    type(window, sel, v);
    const out = document.getElementById("distOut");
    assert.ok(out.querySelectorAll("li").length >= 3, v + " should list steps");
    assert.match(out.querySelector("a").href, /^https:\/\//);
    assert.doesNotMatch(out.textContent, /undefined|NaN/);
  }
  sel.selectedIndex = [...sel.options].findIndex((o) => o.textContent.startsWith("Fremont"));
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.match(document.getElementById("distOut").textContent, /main office or attendance office/);
});

test("ready: every transit row links out safely", async () => {
  const { document } = await loadPage("ready.html");
  const links = [...document.querySelectorAll("#ride table a")];
  assert.ok(links.length >= 8);
  for (const a of links) assert.match(a.getAttribute("rel") || "", /noopener/);
});

test("ready: every city in the ride picker shows its card, cost, what to bring and the pages we read", async () => {
  const { window, document } = await loadPage("ready.html"); await tick(120);
  const sel = document.getElementById("rideSel");
  assert.ok(sel.options.length >= 8, "six cities, the Bay Area and the prompt");
  for (const o of [...sel.options].slice(1).filter((x) => x.value !== "other" && x.value !== "bay")) {
    type(window, sel, o.value);
    const out = document.getElementById("rideOut");
    assert.match(out.textContent, /Where to get it/);
    assert.match(out.textContent, /What to bring/);
    assert.doesNotMatch(out.textContent, /undefined|NaN/);
    assert.ok([...out.querySelectorAll("a")].every((a) => /^https:\/\//.test(a.href)), o.value + " links must be https");
  }
  assert.match(document.getElementById("rideDrive").textContent, /Do not take a job that has you driving/);
});

test("ready: a city we have not read says so instead of showing nothing", async () => {
  const { window, document } = await loadPage("ready.html"); await tick(120);
  type(window, document.getElementById("rideSel"), "other");
  assert.match(document.getElementById("rideOut").textContent, /have not read your transit agency/);
});

test("ready: the opening paragraph is short and the California part sits in its own callout", async () => {
  const { document } = await loadPage("ready.html");
  const lede = document.querySelector(".lede");
  const words = lede.textContent.trim().split(/\s+/).length;
  assert.ok(words <= 45, "lede should be at most 45 words, found " + words);
  const callout = [...document.querySelectorAll(".callout")].find((c) => /Which parts are for California/.test(c.textContent));
  assert.ok(callout, "the California callout should exist");
});

test("ready: the On this page chips link to six sections that exist on the page", async () => {
  const { document } = await loadPage("ready.html");
  const nav = document.querySelector('nav.chips[aria-label="On this page"]');
  assert.ok(nav, "the On this page chip row should exist");
  const links = [...nav.querySelectorAll("a")];
  assert.equal(links.length, 6);
  for (const a of links) {
    const href = a.getAttribute("href") || "";
    assert.match(href, /^#/, href + " should be a fragment link");
    assert.ok(document.getElementById(href.slice(1)), "no element with id " + href.slice(1));
  }
});

test("ready: nothing was deleted when the opening paragraph was shortened", async () => {
  const { document } = await loadPage("ready.html");
  assert.ok(document.body.textContent.includes("certified copy of a birth certificate"));
  assert.ok(document.body.textContent.includes("federal W-4"));
});

test("ready: the Bay Area table shows only when Bay Area is picked, never under another city (it used to be stuck on every pick)", async () => {
  const { window, document } = await loadPage("ready.html"); await tick(120);
  const sel = document.getElementById("rideSel"), bay = document.getElementById("bayRide");
  assert.equal(bay.hidden, true, "hidden before any pick");
  type(window, sel, "bay");
  assert.equal(bay.hidden, false);
  assert.match(document.getElementById("rideOut").textContent, /Bay Area and Sacramento/);
  for (const v of ["atlanta", "nyc", "other", ""]) { type(window, sel, v); assert.equal(bay.hidden, true, "hidden for " + (v || "no pick")); }
  type(window, sel, "atlanta");
  assert.doesNotMatch(document.getElementById("rideOut").textContent, /Sacramento|Clipper/);
});

test("ready: the ride picker is big tap tiles, one per place, and a tap picks it", async () => {
  const { window, document } = await loadPage("ready.html"); await tick(120);
  const tiles = [...document.querySelectorAll("#rideSel + .tp .tile")];
  assert.ok(tiles.length >= 8, "a tile for each place plus somewhere else");
  const atl = tiles.find((t) => /Atlanta/.test(t.textContent));
  atl.click();
  assert.equal(document.getElementById("rideSel").value, "atlanta");
  assert.match(document.getElementById("rideOut").textContent, /MARTA|Breeze/);
  assert.equal([...document.querySelectorAll("#rideSel + .tp .tile")].filter((t) => t.getAttribute("aria-pressed") === "true").length, 1);
});

test("ready: the ride answer is laid out as labelled panels, with 'not stated' shown quietly", async () => {
  const { window, document } = await loadPage("ready.html"); await tick(120);
  type(window, document.getElementById("rideSel"), "atlanta");
  const panels = document.querySelectorAll("#rideOut dl.facts > div");
  assert.ok(panels.length >= 6);
  assert.ok(document.querySelector("#rideOut dd.ns"), "Atlanta says 'Not stated' for how long it lasts");
});
