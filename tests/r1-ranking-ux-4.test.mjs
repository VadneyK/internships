// Live count on every filter chip, including Pay (ticket r1-ranking-ux-4).
// Run with: node --test tests/r1-ranking-ux-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const T = Date.now();

function brute(list, state, now) {
  const out = { hubs: {}, paid: {}, types: {}, fields: {} };
  const count = (s) => list.filter((e) => L.matches(e, s, now)).length;
  L.HUBS.forEach((h) => { out.hubs[h[0]] = count(Object.assign({}, state, { hubs: [h[0]], place: "" })); });
  L.PAID_GROUPS.forEach((g) => { out.paid[g[0]] = count(Object.assign({}, state, { paid: [g[0]] })); });
  Object.keys(L.TYPES).forEach((k) => { out.types[k] = count(Object.assign({}, state, { types: [k] })); });
  Object.keys(L.FIELDS).filter((k) => k !== "any").forEach((k) => { out.fields[k] = count(Object.assign({}, state, { fields: [k] })); });
  return out;
}

const FIXTURE = [
  { id: "a", name: "A", type: "internship", paid_type: "paid", regions: ["oakland"], fields: ["tech-cs"], min_age: 16, status: "rolling" },
  { id: "b", name: "B", type: "internship", paid_type: "unpaid", regions: ["davis"], fields: ["any"], min_age: 14, status: "rolling" },
  { id: "c", name: "C", type: "research", paid_type: "stipend", regions: ["virtual"], fields: ["science", "health"], max_age: 17, status: "rolling" },
  { id: "d", name: "D", type: "research", paid_type: "fee-based", regions: ["oakland", "berkeley"], fields: [], status: "rolling" },
  { id: "e", name: "E", type: "internship", paid_type: "not-stated", regions: ["san-francisco"], fields: ["health"], min_age: 12, max_age: 13, status: "rolling" },
];

test("(a) facetCounts equals a brute-force count with matches for every chip id", () => {
  const states = [
    {}, { age: "14" }, { age: "16", types: ["internship"] }, { place: "city:berkeley", paid: ["pay"] },
    { hubs: ["oak"], fields: ["health"] }, { q: "zzzz" }, { age: "13", paid: ["free", "unknown"], types: ["research"], fields: ["science"] },
  ];
  for (const list of [FIXTURE, DATA]) {
    for (const st of states) {
      const got = L.facetCounts(list, st, T);
      assert.deepEqual(got, brute(list, st, T), JSON.stringify(st));
      for (const g of ["hubs", "paid", "types", "fields"]) for (const v of Object.values(got[g])) assert.ok(Number.isInteger(v) && v >= 0);
    }
  }
  const c = L.facetCounts(FIXTURE, {}, T);
  assert.equal(c.fields.health, 3, "a field chip also counts entries tagged any");
  assert.equal(c.types.research, 2);
  assert.deepEqual(L.facetCounts([], {}, T).paid, { pay: 0, free: 0, fee: 0, unknown: 0 });
});

test("(a2) facetCounts does not change the state it is given and runs fast on every entry", () => {
  const st = { age: "12", hubs: ["oak"], place: "city:berkeley", types: ["research"], paid: ["pay"], fields: ["health"] };
  const copy = JSON.stringify(st);
  const t0 = performance.now();
  L.facetCounts(DATA, st, T);
  const ms = performance.now() - t0;
  assert.equal(JSON.stringify(st), copy);
  assert.ok(DATA.length > 1000);
  assert.ok(ms < 500, "took " + ms + " ms");
});

const chips = (doc, id) => [...doc.querySelectorAll("#" + id + " .chip")];
const nOf = (b) => b.querySelector(".n").textContent;
async function choose(page, id, value) {
  const el = page.document.getElementById(id);
  el.value = value;
  el.dispatchEvent(new page.window.Event("change", { bubbles: true }));
  await tick(100);
}

test("(b) type counts match the data on load and follow the age", async () => {
  const page = await loadPage("find.html");
  await tick(300);
  const { document } = page;
  const before = {};
  for (const b of chips(document, "typeChips")) {
    const t = b.getAttribute("data-val");
    before[t] = nOf(b);
    assert.equal(before[t], String(DATA.filter((e) => e.type === t).length), "load count for " + t);
  }
  await choose(page, "age", "12");
  let lower = 0;
  for (const b of chips(document, "typeChips")) {
    const t = b.getAttribute("data-val");
    const want = DATA.filter((e) => L.matches(e, { age: "12", types: [t] }, Date.now())).length;
    assert.equal(nOf(b), String(want), "age 12 count for " + t);
    if (want < +before[t]) lower++;
  }
  assert.ok(lower >= 1, "at least one type chip shows a lower number after choosing age 12");
  // pay chips have counts too
  const paid = chips(document, "paidChips");
  assert.equal(paid.length, L.PAID_GROUPS.length);
  for (const b of paid) {
    const g = b.getAttribute("data-val");
    const want = DATA.filter((e) => L.matches(e, { age: "12", paid: [g] }, Date.now())).length;
    assert.equal(nOf(b), String(want), "pay count for " + g);
  }
  assert.deepEqual(page.errors, []);
});

test("(c) after choosing a place, hub counts are computed with the place cleared and nothing is NaN", async () => {
  const page = await loadPage("find.html");
  await tick(300);
  const { document } = page;
  const opt = [...document.querySelectorAll("#place option")].find((o) => o.value === "city:berkeley");
  assert.ok(opt, "place list has Berkeley");
  await choose(page, "place", "city:berkeley");
  for (const b of chips(document, "hubChips")) {
    const h = b.getAttribute("data-val");
    const want = DATA.filter((e) => L.matches(e, { hubs: [h] }, Date.now())).length;
    assert.equal(nOf(b), String(want), "hub count for " + h);
  }
  // other groups keep the place
  for (const b of chips(document, "typeChips")) {
    const t = b.getAttribute("data-val");
    const s = { place: "city:berkeley", types: [t] };
    let want = DATA.filter((e) => L.matches(e, s, Date.now())).length;
    if (document.querySelector("#place").value && want !== +nOf(b)) {
      s.placeOnline = true; want = DATA.filter((e) => L.matches(e, s, Date.now())).length;
    }
    assert.equal(nOf(b), String(want), "type count under Berkeley for " + t);
  }
  const text = document.body.textContent;
  assert.ok(!/NaN|undefined/.test(text));
});

test("(d) each chip's aria-label names its count and matches the visible number; zero chips are muted but pressable", async () => {
  const page = await loadPage("find.html", { search: "?age=12" });
  await tick(300);
  const { document } = page;
  let zeros = 0, all = 0;
  for (const id of ["hubChips", "paidChips", "typeChips", "fieldChips"]) {
    for (const b of chips(document, id)) {
      all++;
      const n = nOf(b), label = b.getAttribute("data-label");
      assert.match(n, /^\d+$/);
      assert.equal(b.getAttribute("aria-label"), label + ", " + n + (n === "1" ? " program" : " programs"));
      assert.equal(b.classList.contains("zero"), n === "0");
      if (n === "0") zeros++;
    }
  }
  assert.ok(all > 20);
  // a pressed chip keeps its pressed state at zero
  const zero = [...document.querySelectorAll(".chip.zero")][0] || null;
  if (zero) {
    zero.click(); await tick(100);
    const again = document.querySelector('.chip[data-key="' + zero.getAttribute("data-key") + '"][data-val="' + zero.getAttribute("data-val") + '"]');
    assert.equal(again.getAttribute("aria-pressed"), "true");
    assert.ok(again.classList.contains("zero") || nOf(again) !== "0");
  }
  const one = L.facetCounts([FIXTURE[0]], {}, T);
  assert.equal(one.paid.pay, 1);
});

test("(e) no NaN, undefined or console errors on the page", async () => {
  const page = await loadPage("find.html", { search: "?age=15&at=city:berkeley" });
  await tick(300);
  const text = page.document.body.textContent;
  assert.ok(!/NaN/.test(text) && !/undefined/.test(text));
  assert.deepEqual(page.errors, []);
});
