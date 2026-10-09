import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("ready: loads with no errors and shows an 8 item checklist", async () => {
  const { document, errors } = await loadPage("ready.html");
  assert.deepEqual(errors, []);
  assert.equal(document.querySelectorAll("#readyList input[type=checkbox]").length, 8);
  assert.equal(document.getElementById("readySum").textContent, "0 of 8 done");
});

test("ready: checking items updates the count, is remembered, and Start over clears it", async () => {
  const a = await loadPage("ready.html");
  for (const i of [0, 3]) { // the list is repainted after each change, so look the box up again every time
    const box = a.document.querySelectorAll("#readyList input")[i];
    box.checked = true; box.dispatchEvent(new a.window.Event("change", { bubbles: true }));
  }
  assert.equal(a.document.getElementById("readySum").textContent, "2 of 8 done");
  const b = await loadPage("ready.html", { storage: { ready: { job: true, docs: true } } });
  assert.equal(b.document.getElementById("readySum").textContent, "2 of 8 done");
  b.document.getElementById("readyReset").click();
  assert.equal(b.document.getElementById("readySum").textContent, "0 of 8 done");
});

test("ready: each district shows steps and a link to the page we read; others get the general advice", async () => {
  const { window, document } = await loadPage("ready.html");
  const sel = document.getElementById("dist");
  for (const v of ["davis", "oakland", "sf", "sj"]) {
    type(window, sel, v);
    const out = document.getElementById("distOut");
    assert.ok(out.querySelectorAll("li").length >= 3, v + " should list steps");
    assert.match(out.querySelector("a").href, /^https:\/\//);
    assert.doesNotMatch(out.textContent, /undefined|NaN/);
  }
  sel.selectedIndex = [...sel.options].findIndex((o) => o.textContent.startsWith("Fremont"));
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.match(document.getElementById("distOut").textContent, /main office or attendance office/);
});

test("ready: every transit row links out safely", async () => {
  const { document } = await loadPage("ready.html");
  const links = [...document.querySelectorAll("#ride table a")];
  assert.ok(links.length >= 8);
  for (const a of links) assert.match(a.getAttribute("rel") || "", /noopener/);
});
