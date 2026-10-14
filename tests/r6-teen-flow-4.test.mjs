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

// 2026-10-14 (persona r9 item 4): the find links used to stay national when a state was picked, which sent a
// California family to 1,553 programs in other states. They now follow a state with its own hubs, and come back
// unchanged when the picker returns to All four states (tests/younger-state-links.dom.test.mjs has the rest).
test("younger: the age 12 and 13 find.html links follow a picked state and come back unchanged", async () => {
  const { document, window } = await loadPage("younger.html");
  for (let i = 0; i < 160 && !/^\d+$/.test((document.getElementById("n13") || {}).textContent || ""); i++) await tick(25);
  const f13 = document.querySelector('a[href="find.html?age=13"]');
  const f12 = document.querySelector('a[href="find.html?age=12"]');
  assert.ok(f13 && f12, "both find links exist");
  assert.match(f13.textContent, /programs that take 13 year olds$/);
  assert.match(f12.textContent, /programs that take 12 year olds$/);
  const t13 = f13.textContent, t12 = f12.textContent;
  change(window, document.getElementById("yState"), "ga");
  assert.match(document.querySelector('a[href="find.html?age=13&where=atl"]').textContent, /13 year olds in Georgia$/);
  assert.ok(document.querySelector('a[href="find.html?age=12&where=atl"]'));
  change(window, document.getElementById("yState"), "");
  assert.equal(document.querySelector('a[href="find.html?age=13"]').textContent, t13);
  assert.equal(document.querySelector('a[href="find.html?age=12"]').textContent, t12);
});
