// ux9: Permit questions sit in one column of bordered cards; "Another state" uses the shared type-to-search box (G.placeSearch).
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("permit: questions in a flow grid, no inline grid style, labels unchanged", async () => {
  const p = await loadPage("permit.html"); await tick(300);
  const { document } = p;
  assert.deepEqual(p.errors, []);
  const grid = document.querySelector(".formgrid.formgrid-top.flow");
  assert.ok(grid);
  assert.equal(grid.getAttribute("style"), null);
  assert.equal(grid.querySelectorAll(".field").length, 4);
  assert.equal(grid.querySelectorAll(".step").length, 0);
  assert.equal(document.querySelector('label[for="pAge"]').textContent, "How old are you?");
  assert.equal(document.querySelector('label[for="pLite"]').textContent, "Which state?");
});

test("permit: Another state shows the place box, typing picks, chip clears", async () => {
  const p = await loadPage("permit.html", { search: "?age=16&kind=nonfarm" }); await tick(300);
  const { window, document } = p;
  const st = document.getElementById("pState");
  st.value = "lite"; st.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(400);
  const lite = document.getElementById("pLite");
  assert.ok(lite.classList.contains("tp-hidden"));
  assert.equal(document.querySelectorAll("#pLiteField .tp").length, 0);
  const q = document.getElementById("pLiteQ"); assert.equal(q.placeholder, "Type your state");
  q.value = "colorado"; q.dispatchEvent(new window.Event("input", { bubbles: true }));
  document.getElementById("pLiteOpt0").click(); await tick(100);
  assert.equal(lite.value, "co");
  assert.match(document.querySelector("#pLiteField .chip.clear").textContent, /Colorado/);
  document.querySelector("#pLiteField .chip.clear").click(); await tick(50);
  assert.equal(lite.value, "");
});

test("permit: ?state= deep link to a short-answer state fills the chip", async () => {
  const p = await loadPage("permit.html", { search: "?state=co&age=16&kind=nonfarm" }); await tick(500);
  const { document } = p;
  assert.equal(document.getElementById("pState").value, "lite");
  assert.equal(document.getElementById("pLite").value, "co");
  assert.match(document.querySelector("#pLiteField .chip.clear").textContent, /Colorado/);
  assert.equal(document.getElementById("pLiteField").hidden, false);
  assert.deepEqual(p.errors, []);
});
