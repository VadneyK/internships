// Ticket r2-teen-flow-31: Get ready's checklist has id "checklist" (exactly once, on the block that
// holds #readySum), the On this page chips start with "Your checklist", and a "Jump to your
// checklist" link sits in the notes under the lede (after the last-read line and the no-offer note, which older tests keep directly under the lede). Both links resolve to #checklist.
// Run with: node --test tests/r2-teen-flow-31-ready-checklist-jump.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

test("r2-teen-flow-31: the checklist id exists exactly once and holds the counter", async () => {
  const { document, errors } = await loadPage("ready.html");
  assert.deepEqual(errors, []);
  assert.equal(document.querySelectorAll("#checklist").length, 1, "one element with id checklist");
  const block = document.getElementById("checklist");
  assert.ok(block.querySelector("#readySum"), "the checklist block holds #readySum");
  assert.ok(block.compareDocumentPosition(document.getElementById("readyList")) & document.DOCUMENT_POSITION_FOLLOWING, "the checklist list follows the block");
});

test("r2-teen-flow-31: the first On this page chip is Your checklist and points to #checklist", async () => {
  const { document } = await loadPage("ready.html");
  const nav = document.querySelector("nav#parts");
  assert.ok(nav, "nav#parts exists");
  const first = nav.querySelector("a.chip");
  assert.equal(first, nav.querySelectorAll("a")[0], "first link in the chip row");
  assert.equal(first.textContent.trim(), "Your checklist");
  assert.equal(first.getAttribute("href"), "#checklist");
  assert.equal(document.querySelectorAll('nav#parts a[href="#checklist"]').length, 1);
});

test("r2-teen-flow-31: the Jump to your checklist link comes right after the no-offer note and resolves to #checklist", async () => {
  const { document } = await loadPage("ready.html");
  const jump = document.getElementById("readyNoYes").nextElementSibling;
  assert.equal(jump.tagName, "P", "the next element after the lede is a paragraph");
  const link = jump.querySelector("a");
  assert.ok(link, "the paragraph holds a link");
  assert.equal(link.textContent.trim(), "Jump to your checklist");
  assert.equal(link.getAttribute("href"), "#checklist");
  const target = document.getElementById(link.getAttribute("href").slice(1));
  assert.equal(target.id, "checklist", "the link resolves to the checklist block");
});

test("r2-teen-flow-31: both links resolve to the same single target", async () => {
  const { document } = await loadPage("ready.html");
  const hrefs = [...document.querySelectorAll('a[href="#checklist"]')];
  assert.equal(hrefs.length, 2, "one chip and one jump link");
  for (const a of hrefs) {
    assert.equal(document.getElementById(a.getAttribute("href").slice(1)), document.getElementById("checklist"));
  }
});
