// Ticket r1-teen-flow-5: Get ready has a path for teens with no job offer and a clear finish.
// Run with: node --test tests/r1-teen-flow-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

function setAll(doc, win, on) {
  for (const box of doc.querySelectorAll("#readyList input[type=checkbox]")) {
    box.checked = on; box.dispatchEvent(new win.Event("change", { bubbles: true }));
  }
}

test("r1-teen-flow-5: no-offer note sits under the lede with the three exact links", async () => {
  const { document, errors } = await loadPage("ready.html");
  const note = document.getElementById("readyNoYes");
  assert.ok(note, "readyNoYes exists");
  assert.equal(note.previousElementSibling.className, "lede");
  assert.deepEqual([...note.querySelectorAll("a")].map((a) => a.getAttribute("href")), ["find.html", "jobs.html", "playbook.html"]);
  const words = document.querySelector("p.lede").textContent.trim().split(/\s+/).length;
  assert.ok(words <= 45, "lede is " + words + " words");
  assert.deepEqual(errors, []);
});

test("r1-teen-flow-5: the done callout shows only when all eight are checked", async () => {
  const { window, document, errors } = await loadPage("ready.html");
  const done = document.getElementById("readyDone");
  assert.equal(done.hidden, true, "starts hidden");
  const btns = done.querySelectorAll("a.btn");
  assert.equal(btns.length, 1);
  assert.equal(btns[0].getAttribute("href"), "safety.html");
  assert.equal(btns[0].textContent.trim(), "Read Safe at work");

  setAll(document, window, true);
  assert.equal(document.getElementById("readySum").textContent, "8 of 8 done");
  assert.equal(done.hidden, false, "shown at 8 of 8");
  assert.equal(document.getElementById("readyStatus").textContent, "8 of 8 done", "live text is unchanged");

  const box = document.querySelectorAll("#readyList input")[3];
  box.checked = false; box.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(done.hidden, true, "hidden when one is unchecked");

  setAll(document, window, true);
  assert.equal(done.hidden, false);
  document.getElementById("readyReset").click();
  assert.equal(done.hidden, true, "hidden after Start over");
  assert.deepEqual(errors, []);
});

test("r1-teen-flow-5: a saved full checklist shows the callout on load, and storage still saves", async () => {
  const keys = ["job", "form", "permit", "docs", "ssn", "bank", "tax", "ride"];
  const full = Object.fromEntries(keys.map((k) => [k, true]));
  const a = await loadPage("ready.html", { storage: { ready: full } });
  assert.equal(a.document.getElementById("readyDone").hidden, false);
  const b = await loadPage("ready.html");
  const box = b.document.querySelectorAll("#readyList input")[0];
  box.checked = true; box.dispatchEvent(new b.window.Event("change", { bubbles: true }));
  assert.deepEqual(JSON.parse(b.window.localStorage.getItem("ready")), { job: true });
  assert.equal(b.document.getElementById("readyDone").hidden, true);
});

test("r1-teen-flow-5: the last element in main is section.nextstep with one Safe at work button", async () => {
  const { document } = await loadPage("ready.html");
  const last = document.querySelector("main").lastElementChild;
  assert.equal(last.tagName, "SECTION");
  assert.ok(last.classList.contains("nextstep"));
  assert.equal(last.id, "next-step");
  assert.equal(last.querySelector("h2").textContent.trim(), "Your next step");
  const btns = last.querySelectorAll("a.btn");
  assert.equal(btns.length, 1);
  assert.equal(btns[0].getAttribute("href"), "safety.html");
  assert.equal(btns[0].textContent.trim(), "Read Safe at work");
});
