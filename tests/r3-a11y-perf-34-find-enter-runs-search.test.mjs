// Ticket r3-a11y-perf-5: Enter in the Programs search box (the phone Search key) runs the search at once,
// closes the keyboard (blurs #q) and puts focus on the result count (#count).
// Run with: node --test tests/r3-a11y-perf-34-find-enter-runs-search.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

async function ready() {
  const p = await loadPage("find.html");
  for (let i = 0; i < 80 && /Loading/.test(p.document.getElementById("count").textContent); i++) await tick(25);
  return p;
}

function enter(window, el) {
  el.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
}

// 2026-10-14: wait for the count to settle instead of a fixed 400 ms. Under a loaded machine the typing
// timer and the detail file can land later, and the fixed wait read a half-done count now and then.
async function settled(document) {
  const count = document.getElementById("count");
  await tick(400);
  let last = count.textContent;
  for (let i = 0; i < 50; i++) {
    await tick(100);
    if (count.textContent === last) return last;
    last = count.textContent;
  }
  return last;
}

// The count a page shows once the typing timer has run for the given search (the normal, debounced path).
// The first search also loads the detail file (the long text the search reads), so this is the full count.
async function referenceCount(q) {
  const p = await ready();
  type(p.window, p.document.getElementById("q"), q);
  return settled(p.document);
}

// Load the detail file on this page first, so an Enter press runs against the full data without waiting for it.
async function warmed() {
  const p = await ready();
  type(p.window, p.document.getElementById("q"), "camp");
  await settled(p.document);
  return p;
}

test("Enter after typing 'camp' runs the search at once and moves focus to #count", async () => {
  const expected = await referenceCount("camp");
  assert.match(expected, /^\d+ of \d+ programs$/);
  const { window, document } = await warmed();
  const q = document.getElementById("q"), count = document.getElementById("count");
  q.focus();
  type(window, q, "camp");
  enter(window, q); // no timer advance: the search must already be applied
  assert.equal(count.textContent, expected);
  assert.equal(document.activeElement, count);
  assert.equal(count.getAttribute("tabindex"), "-1");
  assert.notEqual(document.activeElement, q, "#q must not keep focus, so the phone keyboard closes");
});

test("Enter on an empty #q does not throw and leaves focus on #count", async () => {
  const { window, document, errors } = await ready();
  const q = document.getElementById("q"), count = document.getElementById("count");
  q.focus();
  assert.doesNotThrow(() => enter(window, q));
  assert.equal(document.activeElement, count);
  assert.equal(q.value, "");
  assert.deepEqual(errors.filter((e) => /Enter|keydown|TypeError|ReferenceError/.test(e)), []);
});

test("Enter does not change the URL hash and a later input still debounces", async () => {
  const hospital = await referenceCount("hospital");
  const { window, document } = await warmed();
  const q = document.getElementById("q"), count = document.getElementById("count");
  const hashBefore = window.location.hash;
  type(window, q, "camp");
  enter(window, q);
  const afterEnter = count.textContent;
  assert.equal(window.location.hash, hashBefore);

  // A new input after Enter must wait for the usual quiet time, so no second immediate render happens.
  type(window, q, "hospital");
  assert.equal(count.textContent, afterEnter, "input after Enter must not render at once");
  for (let i = 0; i < 50 && count.textContent !== hospital; i++) await tick(100);
  assert.equal(count.textContent, hospital);
});
