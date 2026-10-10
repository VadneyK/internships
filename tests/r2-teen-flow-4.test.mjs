import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

function change(w, el, v) { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); }

test("younger: default table has five columns and a labelled state select", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  assert.equal(document.querySelectorAll("#gridT thead th").length, 5);
  assert.equal(document.querySelector('label[for="yState"]').textContent, "Show one state");
  assert.equal(document.querySelector("#yState option").textContent, "All four states");
  assert.equal(document.querySelectorAll("#yState option").length, 5);
});

test("younger: choosing New York shows one state column and only its phone number, All four restores", async () => {
  const p = await loadPage("younger.html"); await tick(200);
  const { document, window } = p;
  change(window, document.getElementById("yState"), "ny");
  const ths = document.querySelectorAll("#gridT thead th");
  assert.equal(ths.length, 2);
  assert.equal(ths[1].textContent, "New York");
  const last = document.querySelector("#gridT tbody tr:last-child");
  assert.equal(last.querySelectorAll("td").length, 1);
  assert.doesNotMatch(last.textContent, /877-709-8185/);
  assert.equal(document.querySelectorAll("#conflicts li").length > 0, true);
  change(window, document.getElementById("yState"), "");
  assert.equal(document.querySelectorAll("#gridT thead th").length, 5);
  assert.deepEqual(p.errors, []);
});

test("younger: ?state=il preselects Illinois, ?state=xx is ignored", async () => {
  const il = await loadPage("younger.html", { search: "?state=il" }); await tick(200);
  assert.equal(il.document.getElementById("yState").value, "il");
  assert.equal(il.document.querySelectorAll("#gridT thead th")[1].textContent, "Illinois");
  const xx = await loadPage("younger.html", { search: "?state=xx" }); await tick(200);
  assert.equal(xx.document.getElementById("yState").value, "");
  assert.equal(xx.document.querySelectorAll("#gridT thead th").length, 5);
});

async function youngHref(search) {
  const { document } = await loadPage("permit.html", { search }); await tick(300);
  return document.querySelector("#pOut a.btn")?.getAttribute("href");
}

test("permit: the young verdict link carries a supported state only", async () => {
  assert.equal(await youngHref("?state=ca&age=13&kind=job"), "younger.html?state=ca");
  assert.equal(await youngHref("?state=wa&age=13&kind=job"), "younger.html");
});
