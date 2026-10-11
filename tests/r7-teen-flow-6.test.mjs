import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const pick = (document, window, v) => {
  const s = document.getElementById("yState");
  s.value = v;
  s.dispatchEvent(new window.Event("change", { bubbles: true }));
};

test("younger: the parent row has a Text this to a parent link and a Copy link button", async () => {
  const { document, errors } = await loadPage("younger.html"); await tick(200);
  assert.deepEqual(errors, []);
  const row = document.querySelector("p.share-parent[data-share]");
  assert.ok(row, "share row is on the page");
  assert.equal(row.getAttribute("data-share"), "Here is what I can do for work at my age:");
  assert.match(row.textContent, /Show a parent this page/);
  const link = [...row.querySelectorAll("a")].find((a) => a.textContent === "Text this to a parent");
  assert.ok(link, "Text this to a parent link");
  const copy = [...row.querySelectorAll("button")].find((b) => b.textContent === "Copy link");
  assert.ok(copy, "Copy link button");
  assert.equal(copy.type, "button");
  assert.doesNotMatch(document.querySelector("p.lede").textContent, /Show this page to a parent/);
});

test("younger: picking New York writes state=ny to the address and the text link carries it", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(200);
  const headsBefore = document.querySelectorAll("#gridT thead th").length;
  pick(document, window, "ny");
  assert.equal(new window.URL(window.location.href).searchParams.get("state"), "ny");
  assert.equal(headsBefore, 5, "all four states before the pick");
  assert.equal(document.querySelectorAll("#gridT thead th").length, 2, "job column plus New York only");
  assert.match(document.getElementById("gridT").textContent, /New York/);

  const link = [...document.querySelectorAll("p.share-parent a")].find((a) => a.textContent === "Text this to a parent");
  link.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
  const href = decodeURIComponent(link.getAttribute("href"));
  assert.match(href, /^sms:\?&body=/);
  assert.match(href, /Here is what I can do for work at my age:/);
  assert.match(href, /younger\.html\?state=ny/, "the text carries the address with the state");
});

test("younger: All four states removes state from the address and keeps the hash", async () => {
  const { document, window } = await loadPage("younger.html", { search: "?state=ny#grid" }); await tick(200);
  assert.equal(document.getElementById("yState").value, "ny");
  pick(document, window, "");
  const u = new window.URL(window.location.href);
  assert.equal(u.searchParams.has("state"), false);
  assert.equal(u.hash, "#grid");
  assert.equal(u.pathname, "/younger.html");
});

test("younger: a state picked on load is kept in the address on the next change, other params stay", async () => {
  const { document, window } = await loadPage("younger.html", { search: "?state=ga&x=1" }); await tick(200);
  pick(document, window, "il");
  const u = new window.URL(window.location.href);
  assert.equal(u.searchParams.get("state"), "il");
  assert.equal(u.searchParams.get("x"), "1");
});
