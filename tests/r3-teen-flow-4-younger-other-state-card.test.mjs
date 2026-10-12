// Ticket r3-teen-flow-4: "Any other state" hides once one of the four full states is picked.
// Run with: node --test tests/r3-teen-flow-4-younger-other-state-card.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

async function load(search) {
  const { document, errors, window } = await loadPage("younger.html", { search });
  await tick(150);
  assert.deepEqual(errors, []);
  return { document, window };
}
for (const st of ["ca", "ga", "ny", "il"]) {
  test("state=" + st + " hides the card", async () => {
    const { document } = await load("?state=" + st);
    assert.equal(document.getElementById("otherState").hidden, true);
  });
}
for (const q of ["", "?state=tx"]) {
  test("'" + q + "' shows the card with a jump link", async () => {
    const { document } = await load(q);
    const box = document.getElementById("otherState");
    assert.equal(box.hidden, false);
    assert.equal(box.querySelector('a[href="#grid"]').textContent, "Pick your state in part 1");
  });
}
test("changing the picker toggles the card and keeps the status text", async () => {
  const { document, window } = await load("");
  const ys = document.getElementById("yState"), box = document.getElementById("otherState");
  ys.value = "ny"; ys.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(50);
  assert.equal(box.hidden, true);
  assert.match(document.getElementById("yStatus").textContent, /1 of 4 full states/);
  ys.value = ""; ys.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(50);
  assert.equal(box.hidden, false);
  assert.equal(document.getElementById("yStatus").textContent, "Showing all 4 full states.");
});
