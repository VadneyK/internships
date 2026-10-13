// ux9: Paycheck, Ages 12 to 14 and States use the shared place box (G.placeSearch) for their long state lists.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

function pick(p, id, text) {
  const q = p.document.getElementById(id + "Q");
  q.value = text; q.dispatchEvent(new p.window.Event("input", { bubbles: true }));
  const o = p.document.getElementById(id + "Opt0"); assert.ok(o, "a match is offered for " + text);
  o.click();
}

test("younger: yState has a place box; picking a state redraws the page; the chip clears", async () => {
  const p = await loadPage("younger.html"); await tick(300);
  const { document } = p, sel = document.getElementById("yState");
  assert.deepEqual(p.errors, []);
  assert.ok(document.getElementById("yStateQ"), "place box exists");
  assert.ok(sel.classList.contains("tp-hidden"));
  pick(p, "yState", "texas"); await tick(50);
  assert.equal(sel.value, "tx");
  assert.match(document.querySelector(".chip.clear").textContent, /Texas/);
  document.querySelector(".chip.clear").click(); await tick(50);
  assert.equal(sel.value, "");
});

test("younger: a ?state= link shows its chip", async () => {
  const p = await loadPage("younger.html", { search: "?state=ny" }); await tick(300);
  assert.equal(p.document.getElementById("yState").value, "ny");
  assert.match(p.document.querySelector(".chip.clear").textContent, /New York/);
  assert.deepEqual(p.errors, []);
});

test("states: moreSel has a place box; picking a state fills the card", async () => {
  const p = await loadPage("states.html"); await tick(300);
  const { document } = p;
  assert.deepEqual(p.errors, []);
  assert.ok(document.getElementById("moreSelQ"), "place box exists");
  pick(p, "moreSel", "texas"); await tick(50);
  assert.equal(document.getElementById("moreSel").value, "tx");
  assert.match(document.getElementById("moreOut").textContent, /Texas/);
});

test("states: a ?state= link shows its chip", async () => {
  const p = await loadPage("states.html", { search: "?state=tx" }); await tick(300);
  assert.equal(p.document.getElementById("moreSel").value, "tx");
  assert.match(p.document.querySelector(".chip.clear").textContent, /Texas/);
});

test("paycheck: mOtherState has a place box once the wages load; picking a state shows its wage", async () => {
  const p = await loadPage("paycheck.html"); await tick(300);
  const { document, window } = p;
  const preset = document.getElementById("mPreset");
  preset.value = "other"; preset.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(300);
  assert.deepEqual(p.errors, []);
  assert.ok(document.getElementById("mOtherStateQ"), "place box exists");
  pick(p, "mOtherState", "ohio"); await tick(50);
  assert.equal(document.getElementById("mOtherState").value, "oh");
  assert.match(document.getElementById("mOtherWage").textContent, /Ohio|minimum/i);
});
