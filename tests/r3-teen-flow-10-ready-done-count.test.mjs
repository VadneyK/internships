// Ticket r3-teen-flow-10: the Get ready done box does not hard-code a number.
// It says "All done." so it stays right when the checklist length changes.
// Run with: node --test tests/r3-teen-flow-10-ready-done-count.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

function setAll(doc, win, on) {
  for (const box of doc.querySelectorAll("#readyList input[type=checkbox]")) {
    box.checked = on;
    box.dispatchEvent(new win.Event("change", { bubbles: true }));
  }
}

test("r3-teen-flow-10: done box says All done. with no number and agrees with the summary", async () => {
  const { window, document, errors } = await loadPage("ready.html");
  assert.deepEqual(errors, []);
  const done = document.getElementById("readyDone");
  assert.equal(done.hidden, true, "starts hidden");
  assert.equal(done.querySelector("b").textContent.trim(), "All done.");
  assert.doesNotMatch(done.querySelector("b").textContent, /\d|\b(one|two|three|four|five|six|seven|eight)\b/i, "no hard-coded count");

  const boxes = document.querySelectorAll("#readyList input[type=checkbox]");
  assert.equal(boxes.length, 8, "eight checklist boxes");
  setAll(document, window, true);
  assert.equal(document.querySelectorAll("#readyList input[type=checkbox]:checked").length, boxes.length, "every box checked");
  assert.equal(document.getElementById("readySum").textContent, "8 of 8 done");
  assert.equal(done.hidden, false, "done box visible when every box is checked");

  const first = document.querySelectorAll("#readyList input")[0];
  first.checked = false;
  first.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(document.getElementById("readySum").textContent, "7 of 8 done");
  assert.equal(done.hidden, true, "done box hides again after one box is unchecked");
});
