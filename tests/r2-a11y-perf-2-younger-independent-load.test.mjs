// r2-a11y-perf-2: Ages 12 to 14 draws from younger.json alone; the big core file only feeds two counts.
// Run with: node --test tests/r2-a11y-perf-2-younger-independent-load.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const CORE = /data\/entries-core\.json/;
function fetchWith(mode) {
  return (w) => {
    // loadPage installs its own fetch after setup; lock ours in so it cannot replace it
    const mine = (u, o) => {
      const url = new URL(String(u), w.location.href);
      if (CORE.test(url.pathname)) return mode === "hang" ? new Promise(() => {}) : mode === "fail" ? Promise.reject(new Error("offline")) : fetch(url, o);
      return fetch(url, o);
    };
    Object.defineProperty(w, "fetch", { get: () => mine, set() {}, configurable: true });
  };
}
function drawn(document) {
  assert.ok(document.querySelectorAll("#gridT tbody tr").length > 1, "state table is drawn");
  assert.ok(document.querySelector("#next-step a.btn").getAttribute("href").startsWith("find.html?age="), "next-step link set");
  assert.ok(document.getElementById("otherStateRule").textContent.length > 0, "other-state rule is drawn");
}

test("core file never resolves: page still draws", async () => {
  const { document, errors } = await loadPage("younger.html", { setup: fetchWith("hang") }); await tick(300);
  assert.deepEqual(errors, []);
  drawn(document);
});

test("core file rejected: plain wording, no error", async () => {
  const { document, errors } = await loadPage("younger.html", { setup: fetchWith("fail") }); await tick(300);
  assert.deepEqual(errors, []);
  drawn(document);
  assert.equal(document.getElementById("age12Link").textContent, "Browse programs for age 12");
  assert.equal(document.getElementById("n13") , null);
  assert.ok([...document.querySelectorAll("a.btn")].some((a) => a.textContent === "Browse programs for age 13"));
});

test("core file resolves: counts are filled", async () => {
  const { document, errors } = await loadPage("younger.html", { setup: fetchWith("ok") }); await tick(300);
  assert.deepEqual(errors, []);
  assert.match(document.getElementById("n13").textContent, /^\d+$/);
  assert.match(document.getElementById("n12").textContent, /^\d+$/);
});
