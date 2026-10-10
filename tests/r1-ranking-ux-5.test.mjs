// Empty state that says why and offers the one filter to remove (ticket r1-ranking-ux-5).
// Run with: node --test tests/r1-ranking-ux-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LITE = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries-lite.json"), "utf8"));
const T = Date.now();

const FIXTURE = [
  { id: "a", name: "A", type: "internship", paid_type: "paid", regions: ["oakland"], fields: ["health"], min_age: 16, status: "rolling", what_you_do: "hospital desk" },
  { id: "b", name: "B", type: "internship", paid_type: "unpaid", regions: ["davis"], fields: ["any"], min_age: 14, status: "rolling", what_you_do: "hospital volunteer" },
  { id: "c", name: "C", type: "research", paid_type: "stipend", regions: ["virtual"], fields: ["science"], max_age: 17, status: "rolling", what_you_do: "lab" },
  { id: "d", name: "D", type: "research", paid_type: "fee-based", regions: ["oakland"], fields: [], status: "rolling", what_you_do: "lab" },
  { id: "e", name: "E", type: "volunteer", paid_type: "unpaid", regions: ["davis"], fields: ["health"], min_age: 12, max_age: 13, status: "rolling", what_you_do: "hospital cart" },
];

async function loadFind(storage = {}) {
  const p = await loadPage("find.html", { storage });
  for (let i = 0; i < 80 && /Loading/.test(p.document.getElementById("count").textContent); i++) await tick(25);
  return p;
}
const SEARCH_WAIT = 220;
const cardCount = (doc) => doc.querySelectorAll("article.prog").length;
const relaxBtns = (doc) => [...doc.querySelectorAll("#out [data-relax]")];
const countOf = (doc) => Number(/^(\d+) of/.exec(doc.getElementById("count").textContent)[1]);
const btnCount = (b) => Number(/\((\d+) programs?\)$/.exec(b.textContent)[1]);

test("(a) relaxOptions keeps only removals with a non-zero count, highest first, max 3", () => {
  const st = { age: "12", q: "hospital", types: ["research"] };
  const copy = JSON.stringify(st);
  const got = L.relaxOptions(FIXTURE, st, T);
  assert.equal(JSON.stringify(st), copy, "state is not changed");
  // brute force: remove each active filter, count, drop zeros, sort
  const brute = [["q", { q: "" }], ["age", { age: "" }], ["types", { types: [] }]]
    .map(([key, patch], order) => ({ key, order, count: FIXTURE.filter((e) => L.matches(e, Object.assign({}, st, patch), T)).length }))
    .filter((o) => o.count > 0)
    .sort((x, y) => y.count - x.count || x.order - y.order);
  assert.deepEqual(got.map((o) => [o.key, o.count]), brute.map((o) => [o.key, o.count]));
  assert.ok(got.length <= 3);
  got.forEach((o) => { assert.ok(o.count > 0); assert.equal(typeof o.label, "string"); assert.ok(/^Remove /.test(o.label)); });
  for (let i = 1; i < got.length; i++) assert.ok(got[i - 1].count >= got[i].count);
});

test("(a2) relaxOptions: labels, zero counts dropped, the cap, no filters", () => {
  assert.deepEqual(L.relaxOptions(FIXTURE, {}, T), []);
  assert.deepEqual(L.relaxOptions([], { q: "x" }, T), []);
  // the search word is the only cause: removing age does not help
  const only = L.relaxOptions(FIXTURE, { q: "zzzz", age: "15" }, T);
  assert.deepEqual(only.map((o) => o.key), ["q"]);
  assert.equal(only[0].label, "Remove the search word");
  const many = L.relaxOptions(FIXTURE, { age: "12", when: "closed", season: "summer", paid: ["fee"], types: ["volunteer"], fields: ["science"], verified: true, noPermit: true, hubs: ["oak"] }, T);
  assert.ok(many.length <= 3);
  assert.equal(L.relaxOptions(FIXTURE, { when: "closed", q: "" }, T).length, 1);
  assert.equal(L.relaxOptions(FIXTURE, { when: "closed" }, T)[0].label, "Remove Closed now, check back");
  assert.equal(L.relaxOptions(FIXTURE, { when: "closed" }, T)[0].count, FIXTURE.length);
});

test("(b) a search that finds nothing offers 'Remove the search word', which restores the list", async () => {
  const { window, document, errors } = await loadFind();
  const total = countOf(document);
  type(window, document.getElementById("q"), "zzzz");
  await tick(SEARCH_WAIT);
  assert.equal(countOf(document), 0);
  const out = document.getElementById("out");
  assert.match(out.textContent, /Nothing matches all of these\./);
  const btn = relaxBtns(document).find((b) => /^Remove the search word/.test(b.textContent));
  assert.ok(btn, "has the search word button");
  assert.equal(btn.textContent, "Remove the search word (" + total + " programs)");
  assert.ok(document.getElementById("emptyReset"), "Clear all filters stays");
  btn.click();
  await tick();
  assert.equal(document.getElementById("count").textContent, total + " of " + total + " programs");
  assert.equal(document.getElementById("q").value, "");
  assert.equal(document.activeElement, document.querySelector("article.prog"), "focus on the first card");
  assert.deepEqual(errors, []);
});

test("(c) age, Timing and a search that give 0: every button leads to a count above 0", async () => {
  const FULL = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
  const base = { age: "12", when: "closed" };
  const words = [...new Set(FULL.flatMap((e) => (e.name + " " + (e.what_you_do || "")).toLowerCase().match(/[a-z]{5,}/g) || []))];
  const word = words.find((w) => {
    const st = Object.assign({ q: w }, base);
    return FULL.filter((e) => L.matches(e, st, T)).length === 0 && L.relaxOptions(FULL, st, T).length >= 2;
  });
  assert.ok(word, "found a search word that gives 0 with age 12 and Closed now");
  for (let i = 0; i < 3; i++) {
    const { window, document, errors } = await loadFind();
    type(window, document.getElementById("age"), "12");
    type(window, document.getElementById("when"), "closed");
    type(window, document.getElementById("q"), word);
    for (let k = 0; k < 40 && !(countOf(document) === 0 && !document.querySelector("[data-detail-wait]") && document.querySelector("[data-relax]")); k++) await tick(50);
    assert.equal(countOf(document), 0);
    const btns = relaxBtns(document);
    assert.ok(btns.length >= 2 && btns.length <= 3, "2 or 3 buttons, got " + btns.length);
    const counts = btns.map(btnCount);
    assert.deepEqual(counts, [...counts].sort((x, y) => y - x), "highest count first");
    if (!btns[i]) { assert.deepEqual(errors, []); continue; }
    const want = btnCount(btns[i]);
    assert.ok(want > 0);
    btns[i].click();
    await tick(SEARCH_WAIT);
    assert.equal(countOf(document), want, btns[i].textContent + " leads to the count it shows");
    assert.ok(countOf(document) > 0);
    assert.equal(document.activeElement, document.querySelector("article.prog"));
    assert.deepEqual(errors, []);
  }
});

test("(c2) removing the search word keeps the age and the chips", async () => {
  const { window, document, errors } = await loadFind();
  type(window, document.getElementById("age"), "15");
  document.querySelector('#typeChips .chip').click();
  type(window, document.getElementById("q"), "zzzz");
  await tick(SEARCH_WAIT);
  const age = relaxBtns(document).find((b) => b.getAttribute("data-relax") === "age");
  // the search word is the cause, so removing age gives 0 and no age button is offered
  assert.equal(age, undefined);
  const q = relaxBtns(document).find((b) => b.getAttribute("data-relax") === "q");
  assert.ok(q);
  q.click();
  await tick();
  assert.equal(document.getElementById("age").value, "15", "age is kept");
  assert.equal(document.querySelectorAll("#typeChips .chip[aria-pressed=true]").length, 1, "type chip is kept");
  assert.ok(cardCount(document) > 0);
  assert.deepEqual(errors, []);
});

test("(d) My list on with a saved program hidden by a search: the saved text and a button that turns the other filters off", async () => {
  const id = LITE[0].id;
  const { window, document, errors } = await loadFind({ saved: [id] });
  document.getElementById("savedOnly").click();
  await tick();
  type(window, document.getElementById("q"), "zzzz");
  await tick(SEARCH_WAIT);
  const out = document.getElementById("out");
  assert.match(out.querySelector("h3").textContent, /Nothing matches yet/);
  assert.equal(out.textContent.includes("Your list is empty"), false);
  assert.match(out.textContent, /Your saved program does not match these filters\./);
  const off = out.querySelector("[data-relax-saved]");
  assert.ok(off, "has the turn-off button");
  assert.equal(off.textContent, "Turn the other filters off");
  assert.ok(document.getElementById("emptyReset"));
  off.click();
  await tick();
  assert.equal(document.getElementById("q").value, "");
  assert.equal(document.getElementById("savedOnly").getAttribute("aria-pressed"), "true", "My list stays on");
  assert.equal(cardCount(document), 1);
  assert.equal(document.querySelector("article.prog").id, "p-" + id);
  assert.equal(document.activeElement, document.querySelector("article.prog"));
  assert.deepEqual(errors, []);
});

test("(d2) two saved programs: the text says how many", async () => {
  const { window, document, errors } = await loadFind({ saved: [LITE[0].id, LITE[1].id] });
  document.getElementById("savedOnly").click();
  await tick();
  type(window, document.getElementById("q"), "zzzz");
  await tick(SEARCH_WAIT);
  assert.match(document.getElementById("out").textContent, /None of your 2 saved programs match these filters\./);
  assert.deepEqual(errors, []);
});

test("(g) the By deadline view lists the same buttons when nothing matches", async () => {
  const { window, document, errors } = await loadFind();
  document.getElementById("viewDates").click();
  await tick();
  type(window, document.getElementById("q"), "zzzz");
  await tick(SEARCH_WAIT);
  const dates = document.getElementById("dates");
  assert.match(dates.textContent, /Nothing matches all of these\./);
  const btn = dates.querySelector('[data-relax="q"]');
  assert.ok(btn);
  btn.click();
  await tick();
  assert.equal(document.getElementById("q").value, "");
  assert.ok(countOf(document) > 0);
  assert.equal(dates.querySelector("[data-relax]"), null);
  assert.deepEqual(errors, []);
});

test("(e) the empty state still has Clear all filters, and it works", async () => {
  const { window, document, errors } = await loadFind();
  const total = countOf(document);
  type(window, document.getElementById("q"), "zzzz");
  await tick(SEARCH_WAIT);
  const reset = document.getElementById("emptyReset");
  assert.ok(reset);
  reset.click();
  await tick();
  assert.equal(countOf(document), total);
  assert.deepEqual(errors, []);
});
