import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type } from "./dom-helper.mjs";

test("playbook: typed name can be added to the map and marked sent", async () => {
  const { window, document } = await loadPage("playbook.html");
  const btn = document.getElementById("addMark");
  assert.equal(btn.hidden, true);
  type(window, document.getElementById("fTo"), "Mrs. Lee");
  assert.equal(btn.hidden, false);
  assert.equal(btn.textContent, "Add them to my map and mark sent");
  btn.click();
  assert.equal(document.getElementById("planSummary").textContent, "1 of 5 sent");
  assert.match(document.getElementById("pf0").textContent, /Follow up on/);
  assert.equal(document.getElementById("pn0").value, "Mrs. Lee");
  assert.equal(document.getElementById("fToSel").value, "0");
  assert.equal(btn.hidden, true);
  assert.ok(document.querySelector('[data-ics="0"]'));
});

test("playbook: button hidden when all 8 rows are named", async () => {
  const { window, document } = await loadPage("playbook.html");
  for (let k = 0; k < 3; k++) document.getElementById("addPerson").click();
  for (let k = 0; k < 8; k++) type(window, document.getElementById("pn" + k), "Person" + k);
  type(window, document.getElementById("fTo"), "Someone New");
  assert.equal(document.getElementById("addMark").hidden, true);
});
