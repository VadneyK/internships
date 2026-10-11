// Ticket r1-teen-flow-6: the Ages 12 to 14 page offers a button for 12 year olds next to the 13 button.
// Run with: node --test tests/r5-teen-flow-6.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPage, tick } from "./dom-helper.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const lite = JSON.parse(read("data/entries-lite.json"));
const NOW = Date.UTC(2026, 9, 9, 12);

function libFromRepo() {
  const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read("assets/js/lib.js"), ctx);
  return ctx.TIG ? ctx.TIG.lib : ctx.window.TIG.lib;
}

test("r1-teen-flow-6: a 12 year old link sits next to the 13 link and points to find.html?age=12", async () => {
  const p = await loadPage("younger.html"); await tick(200);
  const { document } = p;
  assert.deepEqual(p.errors, [], "no script errors");
  const link = document.getElementById("age12Link");
  assert.ok(link, "link exists");
  assert.equal(link.tagName, "A");
  assert.equal(link.getAttribute("href"), "find.html?age=12");
  const thirteen = document.querySelector('a[href="find.html?age=13"]');
  assert.ok(thirteen, "13 link still there");
  assert.equal(thirteen.parentElement, link.parentElement, "same row as the 13 link");
  assert.equal(thirteen.nextElementSibling, link, "12 link comes right after the 13 link");
});

test("r1-teen-flow-6: #n12 is the count of lite programs that take 12 year olds, and the text reads See N ... 12 year olds", async () => {
  const p = await loadPage("younger.html", { now: NOW }); await tick(200);
  const { document } = p;
  assert.deepEqual(p.errors, []);
  const L = libFromRepo();
  const expected = lite.filter((e) => L.matches(e, { age: "12" }, NOW) && e.min_age != null && e.min_age <= 12).length;
  assert.ok(expected > 0, "there are programs for 12 year olds in the data");
  assert.equal(Number(document.getElementById("n12").textContent), expected);
  const text = document.getElementById("age12Link").textContent.replace(/\s+/g, " ").trim();
  assert.equal(text, "See " + expected + " programs that take 12 year olds");
  assert.doesNotMatch(document.body.textContent, /undefined|NaN/);
});

test("r1-teen-flow-6: when no program takes 12 year olds the link drops the number and says Browse programs for age 12", async () => {
  const p = await loadPage("younger.html", {
    now: NOW,
    setup(w) {
      let f;
      Object.defineProperty(w, "fetch", {
        configurable: true,
        get: () => (u, o) => {
          if (/entries-core\.json/.test(String(u))) return Promise.resolve({ ok: true, json: async () => [] });
          return f(u, o);
        },
        set: (v) => { f = v; },
      });
    },
  });
  await tick(200);
  const { document } = p;
  assert.deepEqual(p.errors, []);
  const link = document.getElementById("age12Link");
  assert.equal(link.getAttribute("href"), "find.html?age=12");
  assert.equal(link.textContent.replace(/\s+/g, " ").trim(), "Browse programs for age 12");
  assert.equal(document.getElementById("n12"), null, "no count span left in the zero case");
});
