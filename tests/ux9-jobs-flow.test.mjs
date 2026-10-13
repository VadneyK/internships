// ux9: Jobs uses numbered step cards and the shared type-to-search state box (G.placeSearch).
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("jobs: two numbered steps in a flow grid, labels unchanged", async () => {
  const p = await loadPage("jobs.html"); await tick(300);
  const { document } = p;
  assert.deepEqual(p.errors, []);
  const grid = document.querySelector(".formgrid.formgrid-top.flow");
  assert.ok(grid, "formgrid wraps the fields");
  const steps = [...grid.querySelectorAll(".field > .step")];
  assert.deepEqual(steps.map((s) => s.textContent), ["1", "2"]);
  steps.forEach((s) => assert.equal(s.getAttribute("aria-hidden"), "true"));
  assert.equal(document.querySelector('label[for="jAge"]').textContent, "How old are you?");
  assert.ok(document.getElementById("jState").classList.contains("tp-hidden"));
  assert.equal(document.getElementById("jStateQ").placeholder, "Type a state or province");
});

test("jobs: typing picks a state, chip clears it, BC works", async () => {
  const p = await loadPage("jobs.html", { search: "?age=16" }); await tick(300);
  const { window, document } = p;
  const sel = document.getElementById("jState"), q = document.getElementById("jStateQ");
  q.value = "brit"; q.dispatchEvent(new window.Event("input", { bubbles: true }));
  const opt = document.getElementById("jStateOpt0"); assert.ok(opt);
  opt.click(); await tick(50);
  assert.equal(sel.value, "BC");
  assert.ok(document.querySelector(".chip.clear"));
  document.querySelector(".chip.clear").click(); await tick(50);
  assert.equal(sel.value, "");
});

test("jobs: ?state= deep link selects the state and shows its chip; Under 14 still works", async () => {
  const p = await loadPage("jobs.html", { search: "?age=u14&state=TX" }); await tick(300);
  const { document } = p;
  assert.equal(document.getElementById("jState").value, "TX");
  assert.match(document.querySelector(".chip.clear").textContent, /Texas/);
  assert.equal(document.getElementById("jAge").value, "u14");
  assert.ok(document.getElementById("jOut").textContent.includes("Under 14"));
  assert.deepEqual(p.errors, []);
});
