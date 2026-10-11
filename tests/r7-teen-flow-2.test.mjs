import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage, tick } from "./dom-helper.mjs";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const prefs = (place) => ({ findprefs: { age: "15", place } });
const val = (p, id) => p.document.getElementById(id).value;

test("stateFromPlace: one state, or empty", () => {
  assert.equal(L.stateFromPlace("city:berkeley"), "ca");
  assert.equal(L.stateFromPlace("city:atlanta"), "ga");
  assert.equal(L.stateFromPlace("area:midwest"), "", "an area spanning states");
  for (const bad of ["", "nope", "city:nowhere", "area:", null, undefined, 5, {}]) assert.equal(L.stateFromPlace(bad), "");
});

test("permit: saved area picks the state and the answer shows", async () => {
  const p = await loadPage("permit.html", { search: "?age=15&kind=job", storage: prefs("city:berkeley") }); await tick();
  assert.deepEqual(p.errors, []);
  assert.equal(val(p, "pState"), "ca");
  assert.match(p.document.getElementById("pOut").textContent, /Permit to Employ and Work/);
});
test("permit: bad or multi-state place changes nothing; address bar wins", async () => {
  for (const place of ["", "junk", "area:midwest"]) {
    const p = await loadPage("permit.html", { storage: prefs(place) }); await tick();
    assert.equal(val(p, "pState"), "");
  }
  const w = await loadPage("permit.html", { search: "?state=ga&age=15&kind=job", storage: prefs("city:berkeley") }); await tick();
  assert.equal(val(w, "pState"), "ga");
});

test("interview: saved area picks the state; saved plan and address bar win", async () => {
  const p = await loadPage("interview.html", { storage: prefs("city:berkeley") }); await tick();
  assert.equal(val(p, "aState"), "ca");
  assert.equal(p.window.localStorage.getItem("interview"), p.window.localStorage.getItem("interview"));
  const n = await loadPage("interview.html", { storage: prefs("area:midwest") }); await tick();
  assert.equal(val(n, "aState"), "");
  const s = await loadPage("interview.html", { storage: { ...prefs("city:berkeley"), interview: { q: {}, refs: [], av: { state: "ga" } } } }); await tick();
  assert.equal(val(s, "aState"), "ga");
  const w = await loadPage("interview.html", { search: "?state=ny&age=15", storage: prefs("city:berkeley") }); await tick();
  assert.equal(val(w, "aState"), "ny");
});

test("paycheck: saved area picks preset and state; others unchanged", async () => {
  const base = await loadPage("paycheck.html"); await tick();
  const d0 = [val(base, "mPreset"), val(base, "mState")];
  const p = await loadPage("paycheck.html", { storage: prefs("city:berkeley") }); await tick();
  assert.deepEqual(p.errors, []);
  assert.match(val(p, "mPreset"), /^ca/); assert.equal(val(p, "mState"), "ca");
  assert.match(p.document.getElementById("mOut").textContent, /Social Security/);
  for (const place of ["", "junk", "area:midwest"]) {
    const q = await loadPage("paycheck.html", { storage: prefs(place) }); await tick();
    assert.deepEqual([val(q, "mPreset"), val(q, "mState")], d0);
  }
  const w = await loadPage("paycheck.html", { search: "?state=ga", storage: prefs("city:berkeley") }); await tick();
  assert.match(val(w, "mPreset"), /^ga/); assert.equal(val(w, "mState"), "ga");
});

test("younger: saved area picks the state grid; address bar wins", async () => {
  const p = await loadPage("younger.html", { storage: prefs("city:berkeley") }); await tick();
  assert.deepEqual(p.errors, []);
  assert.equal(val(p, "yState"), "ca");
  assert.equal(p.document.querySelectorAll("#gridT thead th").length, 2);
  const n = await loadPage("younger.html", { storage: prefs("junk") }); await tick();
  assert.equal(val(n, "yState"), "");
  const w = await loadPage("younger.html", { search: "?state=ny", storage: prefs("city:berkeley") }); await tick();
  assert.equal(val(w, "yState"), "ny");
});
