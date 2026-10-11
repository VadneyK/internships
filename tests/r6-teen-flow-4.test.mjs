import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

function change(w, el, v) { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); }
function permitButton(document) {
  return [...document.querySelectorAll("a")].find((a) => a.textContent.startsWith("Work permit finder"));
}

test("younger: the permit button follows the picked state, and All four states restores plain permit.html", async () => {
  const { document, window, errors } = await loadPage("younger.html"); await tick(200);
  const btn = permitButton(document);
  assert.ok(btn, "Work permit finder button is on the page");
  assert.equal(btn.getAttribute("href"), "permit.html");
  change(window, document.getElementById("yState"), "ny");
  assert.equal(permitButton(document).getAttribute("href"), "permit.html?state=ny");
  change(window, document.getElementById("yState"), "");
  assert.equal(permitButton(document).getAttribute("href"), "permit.html");
  assert.deepEqual(errors, []);
});

test("younger: each of the four states is passed on to the permit page", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(200);
  for (const st of ["ca", "ga", "ny", "il"]) {
    change(window, document.getElementById("yState"), st);
    assert.equal(permitButton(document).getAttribute("href"), "permit.html?state=" + st);
  }
});

test("younger: ?state=il on load gives permit.html?state=il", async () => {
  const { document } = await loadPage("younger.html", { search: "?state=il" }); await tick(200);
  assert.equal(permitButton(document).getAttribute("href"), "permit.html?state=il");
});

test("younger: a bad ?state=xx leaves plain permit.html", async () => {
  const { document } = await loadPage("younger.html", { search: "?state=xx" }); await tick(200);
  assert.equal(permitButton(document).getAttribute("href"), "permit.html");
});

test("younger: the age 12 and 13 find.html links and their button text are unchanged", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(200);
  const f13 = document.querySelector('a[href="find.html?age=13"]');
  const f12 = document.querySelector('a[href="find.html?age=12"]');
  assert.ok(f13 && f12, "both find links exist");
  assert.match(f13.textContent, /programs that take 13 year olds$/);
  assert.match(f12.textContent, /programs that take 12 year olds$/);
  change(window, document.getElementById("yState"), "ga");
  assert.equal(document.querySelector('a[href="find.html?age=13"]').textContent, f13.textContent);
  assert.equal(document.querySelector('a[href="find.html?age=12"]').textContent, f12.textContent);
});
