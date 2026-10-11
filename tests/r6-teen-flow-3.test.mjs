// Ticket r6-teen-flow-3: picking a preset in the paycheck estimate also picks its state in the Late or wrong pay box.
// "Another state" leaves the box alone, changing the box never changes the preset, and ?state= still works.
// Run with: node --test tests/r6-teen-flow-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("paycheck preset picks the matching state in the Late or wrong pay box", async () => {
  const { window, document, errors } = await loadPage("paycheck.html"); await tick(200);
  assert.deepEqual(errors, []);
  const state = () => document.getElementById("mState").value;
  const wrongText = () => document.getElementById("mWrong").textContent;

  type(window, document.getElementById("mPreset"), "ny-up");
  assert.equal(state(), "ny");
  assert.match(wrongText(), /New York/);

  type(window, document.getElementById("mPreset"), "ny-nyc");
  assert.equal(state(), "ny");
  assert.match(wrongText(), /New York/);

  type(window, document.getElementById("mPreset"), "il-youth");
  assert.equal(state(), "il");
  assert.match(wrongText(), /Illinois/);

  type(window, document.getElementById("mPreset"), "il-adult");
  assert.equal(state(), "il");

  type(window, document.getElementById("mPreset"), "ga");
  assert.equal(state(), "ga");
  assert.match(wrongText(), /Georgia/);

  type(window, document.getElementById("mPreset"), "ca");
  assert.equal(state(), "ca");
  assert.match(wrongText(), /California/);
});

test("paycheck 'Another state' leaves the Late or wrong pay box unchanged", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(200);
  type(window, document.getElementById("mPreset"), "il-adult");
  assert.equal(document.getElementById("mState").value, "il");
  type(window, document.getElementById("mPreset"), "other");
  assert.equal(document.getElementById("mState").value, "il");
  assert.match(document.getElementById("mWrong").textContent, /Illinois/);
});

test("paycheck state box alone never changes the preset", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(200);
  type(window, document.getElementById("mPreset"), "ca");
  type(window, document.getElementById("mState"), "ny");
  assert.equal(document.getElementById("mPreset").value, "ca");
  assert.match(document.getElementById("mWrong").textContent, /New York/);
});

test("paycheck preset sync does not change the status line", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(200);
  const before = document.getElementById("mStatus").textContent;
  type(window, document.getElementById("mPreset"), "ny-up");
  assert.equal(document.getElementById("mStatus").textContent, before);
});

test("paycheck ?state=ny still picks New York in both controls", async () => {
  const { document, errors } = await loadPage("paycheck.html", { search: "?state=ny" }); await tick(200);
  assert.deepEqual(errors, []);
  assert.equal(document.getElementById("mPreset").value, "ny-nyc");
  assert.equal(document.getElementById("mState").value, "ny");
  assert.match(document.getElementById("mWrong").textContent, /New York/);
});
