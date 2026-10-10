import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("languages: loads with no errors, lists official pages with safe links, and filters by language and place", async () => {
  const p = await loadPage("languages.html"); await tick(120);
  const { window, document } = p;
  assert.deepEqual(p.errors, []);
  const all = document.querySelectorAll("#lList li").length;
  assert.ok(all >= 20);
  assert.match(document.getElementById("langNote").textContent, /English version is the official one/);
  type(window, document.getElementById("lLang"), "vi");
  const vi = document.querySelectorAll("#lList li").length;
  assert.ok(vi > 0 && vi < all);
  type(window, document.getElementById("lState"), "New York");
  assert.match(document.getElementById("lCount").textContent, /New York/);
  for (const a of document.querySelectorAll("#lList a")) { assert.match(a.href, /^https:\/\//); assert.equal(a.rel, "noopener"); }
  assert.doesNotMatch(document.getElementById("lList").textContent, /undefined|NaN/);
});

test("languages: a language with nothing for a place says so", async () => {
  const { window, document } = await loadPage("languages.html"); await tick(120);
  type(window, document.getElementById("lLang"), "tl");
  type(window, document.getElementById("lState"), "Georgia");
  assert.match(document.getElementById("lList").textContent, /Nothing in that language/);
});
