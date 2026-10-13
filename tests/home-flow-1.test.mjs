// Home picker as a short flow (2026-10-12: home picker flow): 1 age tiles, 2 a place search box with part-of-the-country tiles, 3 interest tiles.
// The three real selects stay the source of truth. Every wait polls for a condition instead of sleeping a fixed time.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { loadPage } from "./dom-helper.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

async function until(fn, what, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) {
    let v;
    try { v = fn(); } catch (e) { v = false; }
    if (v) return v;
    if (Date.now() > end) assert.fail("timed out waiting for " + what);
    await new Promise((r) => setTimeout(r, 25));
  }
}
async function home(opts) {
  const page = await loadPage("index.html", opts);
  const d = page.document;
  await until(() => d.getElementById("pHub").options.length > 2 && d.querySelector("#pHub + .tp .tile"), "the places and the part-of-the-country tiles");
  return page;
}
const q = (d) => d.getElementById("pHubQ");
const typeIn = (w, d, text) => { const i = q(d); i.focus(); i.value = text; i.dispatchEvent(new w.Event("input", { bubbles: true })); };
const key = (w, d, k) => { const e = new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }); q(d).dispatchEvent(e); return e; };
const optionTexts = (d) => [...d.querySelectorAll("#pHubList [role=option]")].map((o) => o.textContent);
const groupTiles = (d) => [...d.querySelectorAll("#pHub + .tp .tp-row > .tile[aria-expanded]")];
const subTiles = (d) => [...d.querySelectorAll("#pHub + .tp .tp-sub:not([hidden]) .tile")];
const anywhere = (d) => [...d.querySelectorAll("#pHub + .tp .tp-row > .tile")].find((b) => b.textContent.trim() === "Anywhere");
const chipOf = (d) => d.querySelector("#pHub").parentNode.querySelector(".chip.clear");

test("home flow: typing bos lists Boston, Enter picks it, and the matches and links follow", async () => {
  const { window, document, errors } = await home();
  assert.equal(q(document).getAttribute("role"), "combobox");
  assert.equal(q(document).getAttribute("aria-expanded"), "false");
  assert.equal(q(document).getAttribute("placeholder"), "Type your city or state");
  typeIn(window, document, "bos");
  assert.ok(optionTexts(document).some((t) => t.startsWith("Boston")), "Boston is an option: " + optionTexts(document));
  assert.equal(q(document).getAttribute("aria-expanded"), "true");
  assert.equal(document.getElementById("pHubList").getAttribute("role"), "listbox");
  assert.equal(q(document).getAttribute("aria-controls"), "pHubList");
  const active = document.getElementById(q(document).getAttribute("aria-activedescendant"));
  assert.ok(active && active.textContent.startsWith("Boston"), "the first match is active");
  const e = key(window, document, "Enter");
  assert.equal(e.defaultPrevented, true, "Enter never submits the form");
  assert.equal(document.getElementById("pHub").value, "city:boston");
  assert.equal(q(document).value, "", "the box is cleared after a pick");
  assert.equal(q(document).getAttribute("aria-expanded"), "false");
  const chip = await until(() => { const c = chipOf(document); return c && !c.parentNode.hidden && c; }, "the chip");
  assert.match(chip.textContent, /^Boston/);
  // the existing behavior ran: matches, the See all link with the place, the closing soon note
  await until(() => /match/.test(document.getElementById("matchStatus").textContent), "the match status");
  await until(() => /at=city%3Aboston/.test(document.querySelector("#matchMore a.btn").getAttribute("href")), "the See all link carries the place");
  assert.match(document.getElementById("soonNote").textContent, /Boston/);
  assert.deepEqual(errors, []);
  window.close();
});

test("home flow: arrow keys move through the matches, Escape closes then clears, a tap on a match picks it", async () => {
  const { window, document, errors } = await home();
  typeIn(window, document, "ca");
  const n = optionTexts(document).length;
  assert.ok(n >= 3 && n <= 8, "a short list, got " + n);
  const ids = () => q(document).getAttribute("aria-activedescendant");
  const first = ids();
  key(window, document, "ArrowDown");
  assert.notEqual(ids(), first);
  assert.equal(document.getElementById(ids()).getAttribute("aria-selected"), "true");
  assert.equal(document.querySelectorAll("#pHubList [aria-selected=true]").length, 1);
  key(window, document, "ArrowUp"); key(window, document, "ArrowUp");
  assert.equal(ids(), "pHubOpt" + (n - 1), "ArrowUp wraps to the last match");
  const e = key(window, document, "Escape");
  assert.equal(e.defaultPrevented, true);
  assert.equal(q(document).getAttribute("aria-expanded"), "false");
  assert.equal(q(document).value, "ca", "the first Escape only closes the list");
  key(window, document, "Escape");
  assert.equal(q(document).value, "", "the next Escape clears the box");
  assert.equal(document.getElementById("pHub").value, "", "Escape picks nothing");
  key(window, document, "ArrowDown"); // an empty box opens nothing
  assert.equal(q(document).getAttribute("aria-expanded"), "false");
  typeIn(window, document, "seattle");
  document.querySelector("#pHubList [role=option]").click();
  assert.equal(document.getElementById("pHub").value, "city:seattle");
  typeIn(window, document, "zzzzqq");
  assert.equal(q(document).getAttribute("aria-expanded"), "false");
  assert.match(document.getElementById("pHubNone").textContent, /No place called/);
  assert.equal(q(document).getAttribute("aria-describedby"), "pHubNone");
  assert.deepEqual(errors, []);
  window.close();
});

test("home flow: a part of the country tile, then a city tile, sets the place", async () => {
  const { window, document, errors } = await home();
  const ne = groupTiles(document).find((b) => b.textContent === "Northeast");
  assert.ok(ne, "Northeast tile");
  ne.click();
  const bos = await until(() => subTiles(document).find((b) => /^Boston\b/.test(b.textContent)), "the Boston tile");
  bos.click();
  assert.equal(document.getElementById("pHub").value, "city:boston");
  assert.match((await until(() => chipOf(document), "the chip")).textContent, /^Boston/);
  assert.equal(document.getElementById("pHub").options[document.getElementById("pHub").selectedIndex].textContent.replace(/\s*\(.*$/, ""), "Boston");
  assert.deepEqual(errors, []);
  window.close();
});

test("home flow: clearing the chip goes back to Anywhere", async () => {
  const { window, document, errors } = await home();
  typeIn(window, document, "boston"); key(window, document, "Enter");
  const chip = await until(() => { const c = chipOf(document); return c && !c.parentNode.hidden && c; }, "the chip");
  assert.match(chip.querySelector(".sr").textContent, /clear/);
  chip.click();
  assert.equal(document.getElementById("pHub").value, "");
  assert.equal(chipOf(document), null, "the chip is gone");
  assert.equal(document.querySelector("#pHubLbl ~ .chips").hidden, true);
  assert.equal(anywhere(document).getAttribute("aria-pressed"), "true");
  assert.equal(document.activeElement, q(document), "focus goes back to the search box");
  // a place set from code (a saved choice) also draws the chip
  document.getElementById("pHub").value = "city:seattle"; document.getElementById("pHub")._tpSync();
  assert.match(chipOf(document).textContent, /^Seattle/);
  assert.deepEqual(errors, []);
  window.close();
});

test("home flow: saved choices from Programs still preselect and show as a chip", async () => {
  const { window, document, errors } = await home({ storage: { findprefs: { age: "15", place: "city:berkeley" } } });
  assert.equal(document.getElementById("pAge").value, "15");
  assert.equal(document.getElementById("pHub").value, "city:berkeley");
  assert.equal(chipOf(document).parentNode.hidden, false);
  assert.deepEqual(errors, []);
  window.close();
});

test("home flow: picking an age raises step 2 and, a moment later, moves focus to the search box; step 1 stays open", async () => {
  const { window, document, errors } = await home();
  const fields = [...document.querySelectorAll("#picker .field")];
  assert.equal(fields.length, 3);
  assert.deepEqual(fields.map((f) => f.querySelector(".step").textContent), ["1", "2", "3"]);
  assert.ok(fields[0].classList.contains("now"), "step 1 starts raised");
  const tiles = [...document.querySelectorAll("#pAge + .tp .tile")];
  assert.deepEqual(tiles.map((b) => b.textContent), ["12", "13", "14", "15", "16", "17", "18"]);
  assert.equal(new Set(tiles.map((b) => b.parentNode)).size, 1, "all ages sit in one wrapping row");
  tiles[3].focus(); tiles[3].click();
  assert.equal(document.getElementById("pAge").value, "15");
  assert.ok(fields[1].classList.contains("now") && !fields[0].classList.contains("now"), "step 2 is raised");
  assert.ok(fields[0].classList.contains("done"));
  assert.equal(fields[0].hidden, false);
  assert.equal(document.activeElement.textContent, "15", "the tile keeps focus at first");
  await until(() => document.activeElement === q(document), "focus on the search box");
  // changing the age later works and does not pull focus away from a place that is already chosen
  typeIn(window, document, "boston"); key(window, document, "Enter");
  const t16 = [...document.querySelectorAll("#pAge + .tp .tile")].find((b) => b.textContent === "16");
  t16.focus(); t16.click();
  assert.equal(document.getElementById("pAge").value, "16");
  assert.ok(fields[2].classList.contains("now"), "with age and place done, step 3 is raised");
  await new Promise((r) => setTimeout(r, 400));
  assert.notEqual(document.activeElement, q(document));
  assert.deepEqual(errors, []);
  window.close();
});

test("home flow: the picker is top aligned, so no step or tile stretches", () => {
  const html = read("index.html");
  assert.match(html, /<div class="formgrid formgrid-top flow">/);
  const css = read("assets/css/style.css");
  assert.match(css, /\.formgrid-top \{ align-items: start; \}/);
  assert.match(css, /\.flow \.field \{[^}]*align-content: start/);
  // the shared grid is not changed for other pages
  assert.match(css, /\.formgrid \{ display: grid; gap: \.9rem 1rem; grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 15rem\), 1fr\)\); \}/);
  // age tiles have one fixed short size
  assert.match(css, /#pAge \+ \.tp \.tile \{ flex: 0 0 3\.4rem;/);
  // each other page keeps the plain grid
  // 2026-10-12: find.html also top aligns its age, timing and season columns (they stretched the same way).
  for (const f of fs.readdirSync(new URL("..", import.meta.url)).filter((x) => x.endsWith(".html") && x !== "index.html" && x !== "find.html")) assert.doesNotMatch(read(f), /formgrid-top/, f);
});

test("home flow: every place of the old list is reachable through search or the part-of-the-country tiles", async () => {
  const { window, document, errors } = await home();
  const sel = document.getElementById("pHub");
  const all = [...sel.options].filter((o) => o.value).map((o) => ({ v: o.value, name: o.textContent.replace(/\s*\((?:\d+|none yet)\)$/, "") }));
  assert.ok(all.length > 60, "the old list has " + all.length + " places");
  const reached = new Set();
  // search by the place's own name (an area also by "All of ...")
  for (const p of all) {
    typeIn(window, document, p.name);
    const count = document.querySelectorAll("#pHubList [role=option]").length;
    for (let k = 0; k < count; k++) {
      typeIn(window, document, p.name);
      document.querySelectorAll("#pHubList [role=option]")[k].click();
      reached.add(sel.value);
    }
  }
  // the tiles: open each part of the country and tap each place in it
  for (let g = 0; g < groupTiles(document).length; g++) {
    if (groupTiles(document)[g].getAttribute("aria-expanded") !== "true") groupTiles(document)[g].click();
    const n = subTiles(document).length;
    assert.ok(n > 0, "part " + g + " shows places");
    for (let j = 0; j < n; j++) {
      if (groupTiles(document)[g].getAttribute("aria-expanded") !== "true") groupTiles(document)[g].click();
      subTiles(document)[j].click();
      reached.add(sel.value);
    }
  }
  const lost = all.filter((p) => !reached.has(p.v)).map((p) => p.v);
  assert.deepEqual(lost, [], "places no one can reach");
  assert.deepEqual(errors, []);
  window.close();
});

test("home flow: the real selects stay in the page as the source of truth, and the plain page works with no script", () => {
  const html = read("index.html");
  const dom = new JSDOM(html); // scripts do not run
  const d = dom.window.document;
  for (const id of ["pAge", "pHub", "pField"]) {
    const s = d.getElementById(id);
    assert.ok(s && s.tagName === "SELECT", id + " is a real select");
    assert.equal(s.classList.contains("tp-hidden"), false, id + " is not hidden before the script runs");
    assert.equal(s.hasAttribute("hidden"), false);
    assert.ok(d.querySelector('label[for="' + id + '"]'), id + " has its label");
  }
  assert.equal(d.getElementById("pHubQ"), null, "the search box is added by script only");
  assert.deepEqual([...d.querySelectorAll("#picker label")].map((l) => l.textContent), ["How old are you?", "Where do you live or go to school?", "What are you curious about?"]);
  assert.match(d.getElementById("goalChips").textContent, /Or pick a goal:/);
  assert.match(d.getElementById("hubHelp").textContent, /^Town not listed\?/);
  assert.equal([...d.querySelectorAll("#pAge option")].length, 8);
});

test("home flow: the new code sends nothing out and avoids long dashes", () => {
  for (const f of ["assets/js/home.js", "assets/css/style.css", "src/index.html", "tests/home-flow-1.test.mjs"]) {
    const t = read(f);
    assert.equal(new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]").test(t), false, f + " has a long dash");
  }
  const js = read("assets/js/home.js");
  assert.doesNotMatch(js, /XMLHttpRequest|sendBeacon|WebSocket|importScripts/);
});
