import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const line = (d) => d.getElementById("readyOtherState");

test("ready: a Georgia area shows where to go instead", async () => {
  const p = await loadPage("ready.html", { storage: { findprefs: { place: "city:atlanta" } } }); await tick(100);
  assert.deepEqual(p.errors, []);
  assert.equal(line(p.document).hidden, false);
  assert.match(line(p.document).textContent, /Your area is outside California\./);
  assert.equal(p.document.getElementById("readyOtherPermit").getAttribute("href"), "permit.html?state=ga");
  assert.equal(p.document.getElementById("readyOtherPay").getAttribute("href"), "paycheck.html?state=ga");
});

test("ready: a Texas area links the permit finder but plain paycheck", async () => {
  const p = await loadPage("ready.html", { storage: { findprefs: { place: "city:austin" } } }); await tick(100);
  assert.equal(p.document.getElementById("readyOtherPermit").getAttribute("href"), "permit.html?state=tx");
  assert.equal(p.document.getElementById("readyOtherPay").getAttribute("href"), "paycheck.html");
});

test("ready: ?state= names a non-California state", async () => {
  const p = await loadPage("ready.html", { search: "?state=ny" }); await tick(100);
  assert.equal(line(p.document).hidden, false);
  assert.equal(p.document.getElementById("readyOtherPay").getAttribute("href"), "paycheck.html?state=ny");
});

test("ready: California and empty storage keep it hidden", async () => {
  for (const o of [{ storage: { findprefs: { place: "city:davis" } } }, {}, { search: "?state=ca" }]) {
    const p = await loadPage("ready.html", o); await tick(100);
    assert.equal(line(p.document).hidden, true);
    assert.deepEqual(p.errors, []);
  }
});

test("ready: hostile findprefs values do not throw", async () => {
  for (const v of [5, null, "x", [1], { place: 7 }, { place: null }]) {
    const p = await loadPage("ready.html", { storage: { findprefs: v } }); await tick(100);
    assert.equal(line(p.document).hidden, true);
    assert.deepEqual(p.errors, []);
  }
});
