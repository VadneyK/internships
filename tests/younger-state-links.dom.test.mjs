// 2026-10-14 (persona round 9, items 4 and 9): on younger.html a picked state carries into the Programs links.
// "See 359 programs that take 13 year olds" used to open find.html?age=13, which showed 1,553 national programs and
// lost California. Now the links add where= with the hubs that sit wholly inside the state, the counts use the same
// hubs, a note gives the cards that do not state an age (so the numbers add up to what Programs shows), and the
// "Who to ask" row has tap-to-call links. A state with no hub of its own keeps the national link.
// Run with: node --test tests/younger-state-links.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadPage, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
globalThis.window = globalThis.window || {};
const L = require("../assets/js/lib.js");
const CA = "davis,sv,oak,sf,state,socal,cv";

async function ready(search) {
  const p = await loadPage("younger.html", { search });
  for (let i = 0; i < 160 && !/^\d+$/.test((p.document.getElementById("n13") || {}).textContent || ""); i++) await tick(25);
  return p;
}
const href13 = (d) => d.getElementById("n13").closest("a").getAttribute("href");

test("the California hubs are exactly the hubs whose regions are all in California", () => {
  const ca = L.HUBS.filter((h) => h[2].every((r) => L.STATE_OF[r] === "ca")).map((h) => h[0]);
  assert.equal(ca.join(","), CA);
});

test("state=ca: both count links, the next step and yNext carry where= with the California hubs", async () => {
  const { document } = await ready("?age=13&state=ca");
  assert.equal(href13(document), "find.html?age=13&where=" + CA);
  assert.equal(document.getElementById("age12Link").getAttribute("href"), "find.html?age=12&where=" + CA);
  assert.equal(document.querySelector("#yNext a").getAttribute("href"), "find.html?age=13&where=" + CA);
  assert.match(document.getElementById("n13").closest("a").textContent, /13 year olds in California$/);
});

test("state=ca: the count plus the not-stated note equals what Programs shows for the same link", async () => {
  const { document, window } = await ready("?age=13&state=ca");
  const n13 = Number(document.getElementById("n13").textContent);
  const note = document.getElementById("nNote");
  assert.equal(note.hidden, false);
  const more = Number(/also lists (\d+) more/.exec(note.textContent)[1]);
  const find = await loadPage("find.html", { search: "?age=13&where=" + CA });
  const c = find.document.getElementById("count");
  for (let i = 0; i < 200 && !/^\d+ of \d+ programs$/.test(c.textContent); i++) await tick(25);
  assert.equal(n13 + more, Number(/^(\d+) of/.exec(c.textContent)[1]));
});

test("a state with no hub of its own (Kansas) keeps the national links and no 'in' suffix", async () => {
  const { document } = await ready("?age=13&state=ks");
  assert.equal(href13(document), "find.html?age=13");
  assert.doesNotMatch(document.getElementById("n13").closest("a").textContent, / in /);
});

test("changing the picker updates the links and the counts", async () => {
  const { document, window } = await ready("?age=13");
  const before = Number(document.getElementById("n13").textContent);
  const ys = document.getElementById("yState");
  ys.value = "ga";
  ys.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(href13(document), "find.html?age=13&where=atl");
  assert.ok(Number(document.getElementById("n13").textContent) < before);
  ys.value = "";
  ys.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(href13(document), "find.html?age=13");
  assert.equal(Number(document.getElementById("n13").textContent), before);
});

test("the Who to ask row turns phone numbers into tel: links", async () => {
  const { document } = await ready("?age=13&state=ca");
  const rows = [...document.querySelectorAll("#gridT tbody tr")];
  const ask = rows.find((r) => r.querySelector("th").textContent === "Who to ask");
  assert.ok(ask.querySelector('a[href^="tel:+1"]'));
});

test("the count button label is one span, so the flex button does not split it into columns", () => {
  const html = fs.readFileSync(new URL("../younger.html", import.meta.url), "utf8");
  assert.match(html, /<a class="btn" href="find\.html\?age=13"><span>See <span id="n13">/);
});
