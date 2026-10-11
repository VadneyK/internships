// Tap tiles are rebuilt on every change. Keyboard focus must stay on the matching tile.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tiles = (root) => [...root.querySelectorAll(".tile")];

test("index.html: age tile keeps focus, outside focus is not stolen", async () => {
  const { window, document, errors } = await loadPage("index.html");
  await wait(100);
  const age = tiles(document).find((b) => b.textContent.trim() === "15");
  assert.ok(age, "age tile 15");
  const wrap = age.closest(".tp");
  age.focus(); age.click();
  const a = document.activeElement;
  assert.ok(a.classList.contains("tile") && a.isConnected && wrap.contains(a));
  assert.equal(a.textContent.trim(), "15");
  assert.equal(a.getAttribute("aria-pressed"), "true");

  const btn = document.getElementById("themeBtn");
  btn.focus();
  const sel = document.querySelector("select[data-tiles]");
  sel.selectedIndex = sel.options.length - 1; sel._tpSync();
  assert.equal(document.activeElement, btn);
  assert.deepEqual(errors, []);
  window.close();
});

test("find.html: grouped Where picker keeps focus", async () => {
  const { window, document, errors } = await loadPage("find.html");
  await wait(200);
  const hub = document.querySelector("#place").nextElementSibling;
  const group = [...hub.querySelectorAll(".tp-row .tile")].find((b) => b.hasAttribute("aria-expanded"));
  assert.ok(group, "group tile");
  const gt = group.textContent;
  group.focus(); group.click();
  let a = document.activeElement;
  assert.equal(a.textContent, gt);
  assert.equal(a.getAttribute("aria-expanded"), "true");
  assert.ok(a.isConnected);
  const city = hub.querySelector(".tp-sub .tile");
  assert.ok(city, "sub tile");
  const ct = city.textContent;
  city.focus(); city.click();
  a = document.activeElement;
  assert.equal(a.textContent, ct);
  assert.ok(a.isConnected && a.classList.contains("tile"));
  const any = [...hub.querySelectorAll(".tp-row .tile")].find((b) => b.textContent.trim() === "Anywhere");
  assert.ok(any, "Anywhere tile");
  any.focus(); any.click();
  assert.equal(document.activeElement.textContent.trim(), "Anywhere");
  assert.ok(document.activeElement.isConnected);
  assert.deepEqual(errors, []);
  window.close();
});

test("permit.html: focus stays on a picked tile", async () => {
  const { window, document, errors } = await loadPage("permit.html");
  await wait(100);
  const t = tiles(document)[1];
  const text = t.textContent;
  t.focus(); t.click();
  assert.equal(document.activeElement.textContent, text);
  assert.ok(document.activeElement.isConnected);
  assert.deepEqual(errors, []);
  window.close();
});
