import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("r2-younger-1: Any other state block comes first with the federal rule, three steps and the permit finder link", async () => {
  const { document, errors } = await loadPage("younger.html"); await tick(200);
  assert.deepEqual(errors, []);
  const box = document.getElementById("otherState");
  assert.match(box.querySelector("h2").textContent, /Any other state/);
  assert.match(box.textContent, /under 14 may not be employed in most non-farm jobs/);
  assert.match(box.textContent, /casual babysitting are not covered/);
  assert.match(box.textContent, /stricter/);
  assert.equal(box.querySelectorAll("#otherStateSteps li").length, 3);
  assert.equal(box.querySelector("#otherStatePermit").getAttribute("href"), "permit.html");
  const h2s = [...document.querySelectorAll("main h2")];
  assert.equal(h2s[0].id, "otherStateH", "the other-state block is the first section heading");
});

test("r2-younger-1: near-home earning ideas come before the state grid", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  const near = document.getElementById("near"), grid = document.getElementById("grid");
  assert.ok(near.compareDocumentPosition(grid) & 4, "near is before grid");
  assert.ok(!grid.contains(near));
  assert.equal(document.querySelectorAll("#nearL li").length, 4);
});

test("r2-younger-1: 18+ apps sit in a closed details, none in an open table", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  const det = document.getElementById("sitesAdult");
  assert.equal(det.tagName, "DETAILS");
  assert.equal(det.hasAttribute("open"), false);
  assert.match(det.querySelector("summary").textContent, /Apps you cannot join yet, and why/);
  assert.match(det.textContent, /Care\.com/);
  assert.equal(det.querySelectorAll("tbody tr").length, 7);
  assert.equal(document.getElementById("sitesWrap"), null, "no open table of apps is left");
  assert.equal(document.getElementById("sitesNone").hidden, false);
});
