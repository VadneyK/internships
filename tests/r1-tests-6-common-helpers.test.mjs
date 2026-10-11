// Ticket r1-tests-6: direct tests for the shared helpers in assets/js/common.js (copy, toast, download, new-tab links).
// Run with: node --test tests/r1-tests-6-common-helpers.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

function setClipboard(window, value) {
  Object.defineProperty(window.navigator, "clipboard", { value, configurable: true });
}

test("G.copy with no navigator.clipboard falls back to execCommand and toasts", async () => {
  const { window, document } = await loadPage("about.html");
  setClipboard(window, undefined);
  let called = 0;
  document.execCommand = (c) => { called++; return c === "copy"; };
  assert.doesNotThrow(() => window.TIG.copy("hello"));
  assert.equal(called, 1);
  assert.equal(document.getElementById("toast").textContent, "Copied");
  assert.equal(document.querySelectorAll("textarea").length, 0, "fallback textarea is removed");
});

test("G.copy fallback tells the teen how to copy by hand when execCommand fails or throws", async () => {
  const { window, document } = await loadPage("about.html");
  setClipboard(window, undefined);
  document.execCommand = () => false;
  window.TIG.copy("x");
  assert.equal(document.getElementById("toast").textContent, "Press Ctrl+C or Cmd+C to copy");
  document.execCommand = () => { throw new Error("blocked"); };
  assert.doesNotThrow(() => window.TIG.copy("x"));
  await tick(80); // a repeated message goes empty for a moment so it is announced again
  assert.equal(document.getElementById("toast").textContent, "Press Ctrl+C or Cmd+C to copy");
  assert.equal(document.querySelectorAll("textarea").length, 0);
});

test("G.copy when writeText rejects falls back and still toasts", async () => {
  const { window, document } = await loadPage("about.html");
  let wrote = null;
  setClipboard(window, { writeText: (t) => { wrote = t; return Promise.reject(new Error("denied")); } });
  document.execCommand = () => true;
  assert.doesNotThrow(() => window.TIG.copy("abc"));
  await tick(30);
  assert.equal(wrote, "abc");
  assert.equal(document.getElementById("toast").textContent, "Copied");
  assert.equal(document.querySelectorAll("textarea").length, 0);
});

test("G.copy when writeText resolves shows Copied and does not use the fallback", async () => {
  const { window, document } = await loadPage("about.html");
  setClipboard(window, { writeText: () => Promise.resolve() });
  let called = 0;
  document.execCommand = () => { called++; return true; };
  window.TIG.copy("abc");
  await tick(30);
  assert.equal(called, 0);
  assert.equal(document.getElementById("toast").textContent, "Copied");
  assert.ok(document.getElementById("toast").classList.contains("show"));
});

test("G.toast twice leaves one toast element showing the latest text, and hides itself", async () => {
  const { window, document } = await loadPage("about.html");
  window.TIG.toast("first");
  window.TIG.toast("second");
  const all = document.querySelectorAll("#toast");
  assert.equal(all.length, 1);
  assert.equal(all[0].textContent, "second");
  assert.ok(all[0].classList.contains("show"));
  await tick(2500);
  assert.equal(document.querySelectorAll("#toast").length, 1);
  assert.ok(!document.getElementById("toast").classList.contains("show"), "show class is removed after the timer");
});

test("G.download with text and with a JSON string makes a named anchor and revokes its URL", async () => {
  const { window, document } = await loadPage("about.html");
  const made = [], revoked = [], blobs = [], clicks = [];
  window.URL.createObjectURL = (b) => { blobs.push(b); const u = "blob:test/" + made.length; made.push(u); return u; };
  window.URL.revokeObjectURL = (u) => revoked.push(u);
  window.HTMLAnchorElement.prototype.click = function () { clicks.push([this.download, this.href]); };
  assert.doesNotThrow(() => window.TIG.download("notes.txt", "plain words"));
  assert.doesNotThrow(() => window.TIG.download("saved.json", JSON.stringify({ a: [1, 2] }), "application/json"));
  assert.deepEqual(clicks.map((c) => c[0]), ["notes.txt", "saved.json"]);
  assert.deepEqual(clicks.map((c) => c[1]), made);
  assert.equal(blobs[0].type, "text/plain");
  assert.equal(blobs[1].type, "application/json");
  assert.equal(document.querySelectorAll("a[download]").length, 0, "anchor is removed from the page");
  await tick(4300);
  assert.deepEqual(revoked, made);
});

test("G.download accepts a ready-made Blob without re-wrapping it", async () => {
  const { window } = await loadPage("about.html");
  const blobs = [];
  window.URL.createObjectURL = (b) => { blobs.push(b); return "blob:x"; };
  window.HTMLAnchorElement.prototype.click = function () {};
  const b = new window.Blob(["x"], { type: "text/csv" });
  window.TIG.download("a.csv", b);
  assert.equal(blobs[0], b);
});

test("G.printOnly copies one node into a print layer and strips ids; a second call while open does nothing", async () => {
  const { window, document } = await loadPage("about.html");
  const n = document.createElement("div");
  n.id = "one"; n.innerHTML = '<p id="inner">hi</p>';
  document.body.appendChild(n);
  window.TIG.printOnly(n, "Print me");
  assert.equal(window.__printed, 1);
  const root = document.getElementById("printRoot");
  assert.ok(root);
  assert.equal(root.querySelectorAll("[id]").length, 0);
  assert.equal(document.title, "Print me");
  assert.ok(document.body.classList.contains("print-one"));
  window.TIG.printOnly(n, "Again");
  assert.equal(window.__printed, 1);
  window.dispatchEvent(new window.Event("afterprint"));
  assert.equal(document.getElementById("printRoot"), null);
  assert.ok(!document.body.classList.contains("print-one"));
  assert.notEqual(document.title, "Print me");
});

test("G.markNewTabLinks keeps noopener on external _blank links, skips same-site links, and is safe twice", async () => {
  const { window, document } = await loadPage("about.html");
  const main = document.querySelector("main");
  main.insertAdjacentHTML("beforeend",
    '<a id="t1" href="https://example.org/a" target="_blank" rel="noopener noreferrer">Plain</a>' +
    '<a id="t2" href="https://example.org/b" target="_blank" rel="noopener" aria-label="Example B">B</a>' +
    '<a id="t3" href="playbook.html">Same site</a>');
  window.TIG.markNewTabLinks(document);
  window.TIG.markNewTabLinks(document);
  await tick(30);
  const t1 = document.getElementById("t1"), t2 = document.getElementById("t2"), t3 = document.getElementById("t3");
  assert.deepEqual(t1.getAttribute("rel").split(/\s+/), ["noopener", "noreferrer"], "rel tokens do not grow");
  assert.equal(t1.querySelectorAll("span.sr[data-newtab]").length, 1);
  assert.equal(t2.getAttribute("aria-label"), "Example B, opens in a new tab");
  assert.equal(t3.innerHTML, "Same site");
  assert.equal(t3.getAttribute("rel"), null);
  assert.equal(t3.getAttribute("aria-label"), null);
  for (const a of document.querySelectorAll('a[target="_blank"]')) {
    assert.match(a.getAttribute("rel") || "", /noopener/, "every new-tab link on the page has noopener: " + a.href);
  }
});
