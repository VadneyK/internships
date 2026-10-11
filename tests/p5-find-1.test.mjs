import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage, tick } from "./dom-helper.mjs";
const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");

test("p5-find-1: every whole-state choice maps to a real state-level region and sits in exactly one group", () => {
  const ids = new Set(L.REGIONS.map((r) => r[0]));
  const seen = [];
  for (const [, , , states] of L.PICK_GROUPS) for (const s of states) seen.push(s);
  assert.deepEqual([...seen].sort(), L.STATES.map((s) => s[0]).sort());
  assert.equal(new Set(seen).size, seen.length);
  for (const [id, label, region] of L.STATES) {
    assert.ok(ids.has(region), region);
    assert.deepEqual(L.placeRegions("state:" + id), [region]);
    assert.equal(L.placeLabel("state:" + id), label);
  }
  for (const id of ["ohio", "indiana", "michigan", "virginia", "new-jersey", "pennsylvania", "maryland", "minnesota", "wisconsin", "washington", "texas", "massachusetts", "north-carolina", "illinois", "georgia", "new-york-state", "british-columbia"])
    assert.ok(L.placeRegions("state:" + id), id);
  assert.equal(L.placeRegions("state:nowhere"), null);
});

test("p5-find-1: placeCounts counts state places the same way matches does", () => {
  const entries = [{ regions: ["ohio"] }, { regions: ["columbus", "ohio"] }, { regions: ["virtual"] }, { regions: ["texas"] }];
  const c = L.placeCounts(entries);
  assert.equal(c["state:ohio"], 2);
  assert.equal(c["state:texas"], 1);
  assert.equal(c["state:virginia"], 0);
  for (const k of Object.keys(c)) assert.equal(c[k], entries.filter((e) => L.matches(e, { place: k }, Date.now())).length, k);
});

test("p5-find-1: Where has an All of Ohio tile in the Midwest group, and the link ?at=state:ohio works and is saved", async () => {
  const { window, document } = await loadPage("find.html?at=state:ohio"); await tick(150);
  assert.equal(document.getElementById("place").value, "state:ohio");
  const sub = [...document.querySelectorAll("#place + .tp .tp-sub .tile")];
  const t = sub.find((x) => /^All of Ohio/.test(x.textContent));
  assert.ok(t, "All of Ohio tile");
  assert.equal(t.getAttribute("aria-pressed"), "true");
  const other = sub.find((x) => /^Columbus/.test(x.textContent));
  other.click(); await tick(60);
  t.click(); await tick(60);
  assert.equal(document.getElementById("place").value, "state:ohio");
  assert.equal(JSON.parse(window.localStorage.getItem("findprefs")).place, "state:ohio");
});

const HELP = /Ask your school counselor: do we have a list of local jobs or job training for students\? Some schools call it career tech or work-based learning\./;

test("p5-find-1: with fewer than 5 matches the counselor help sits above the results, and its button adds online programs", async () => {
  const { document } = await loadPage("find.html?at=state:ohio&age=12&when=open"); await tick(150);
  const help = document.getElementById("townHelp"), out = document.getElementById("out");
  assert.equal(help.hidden, false);
  assert.ok(help.compareDocumentPosition(out) & 4, "help is before the results");
  assert.match(help.textContent, HELP);
  const btn = document.getElementById("townMore");
  assert.equal(btn.textContent, "See statewide and online programs");
  btn.click(); await tick(100);
  assert.equal(document.getElementById("place").value, "state:ohio");
  assert.match(document.getElementById("townHelp").textContent, /Online and national programs are included/);
  assert.equal(document.getElementById("townMore"), null);
  assert.ok(out.querySelectorAll("article.prog").length >= 2);
});

test("p5-find-1: from a city the button moves to its whole state and saves it", async () => {
  const { window, document } = await loadPage("find.html?at=city:columbus&age=12&when=open"); await tick(150);
  const help = document.getElementById("townHelp");
  if (help.hidden) return;
  document.getElementById("townMore").click(); await tick(100);
  assert.equal(document.getElementById("place").value, "state:ohio");
  assert.equal(JSON.parse(window.localStorage.getItem("findprefs")).place, "state:ohio");
});

test("p5-find-1: a place with plenty of programs shows no help card", async () => {
  const { document } = await loadPage("find.html?at=state:maryland"); await tick(150);
  assert.equal(document.getElementById("townHelp").hidden, true);
  const none = await loadPage("find.html"); await tick(150);
  assert.equal(none.document.getElementById("townHelp").hidden, true);
});
