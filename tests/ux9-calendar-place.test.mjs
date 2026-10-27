// ux9: Calendar uses the shared place box (G.placeSearch + G.placeTiles) like Programs, with no region caption and an "Everywhere" tile.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("calendar: place search box, chip, grouped tiles, Everywhere label, no caption", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" }); await tick(300);
  const { window, document } = p;
  assert.deepEqual(p.errors, []);
  const sel = document.getElementById("cPlace"), q = document.getElementById("cPlaceQ");
  assert.ok(q, "the type-to-search box exists");
  assert.equal(q.getAttribute("role"), "combobox");
  assert.ok(sel.classList.contains("tp-hidden"));
  assert.doesNotMatch(document.body.textContent, /Or pick a part of the country/);
  const tiles = [...sel.parentNode.querySelectorAll(".tp > .tp-row .tile")].map((b) => b.textContent);
  assert.ok(tiles.includes("Everywhere"), "any label stays Everywhere");
  assert.ok(!tiles.includes("Anywhere"));
  assert.ok(tiles.length < 15, "regions, not a flat wall of places");
  const rowsText = () => [...document.querySelectorAll("#cClose li, #cOpen li")].map((li) => li.textContent);
  const before = rowsText();
  assert.equal(before.length, 38, "February list before picking a place");
  // type a place and pick it
  q.value = "midwest"; q.dispatchEvent(new window.Event("input", { bubbles: true }));
  const opt = document.getElementById("cPlaceOpt0"); assert.ok(opt, "a match is offered");
  opt.click(); await tick(50);
  assert.ok(sel.value);
  assert.equal(sel.value, "area:midwest");
  assert.match(document.querySelector(".chip.clear").textContent, /Midwest/, "chip names the picked place");
  const after = rowsText();
  assert.equal(after.length, 4, "exactly the Midwest programs stay");
  for (const name of ["Chicago Police and Firefighter Training Academy", "Fermilab VALOR JROTC Summer Internship", "Chicago Park District summer jobs", "Fermilab PRISM"]) {
    assert.ok(after.some((t) => t.includes(name)), name + " is kept");
  }
  assert.ok(before.some((t) => !after.includes(t)), "programs outside the Midwest are dropped");
  document.querySelector(".chip.clear").click(); await tick(50);
  assert.equal(sel.value, "");
});

test("calendar: deep link at= still selects the place and shows its chip", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2&at=area:midwest" }); await tick(300);
  const { document } = p;
  assert.equal(document.getElementById("cPlace").value, "area:midwest");
  assert.match(document.querySelector(".chip.clear").textContent, /Midwest/);
  assert.deepEqual(p.errors, []);
});
