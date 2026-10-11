// permits.json (state rules) loads only when the hours checker is used.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const count = (log) => log.filter((f) => /data\/permits\.json/.test(String(f.url))).length;

for (const ev of ["focusin", "pointerdown", "change"]) {
  test("interview: permits.json waits for " + ev + " in the checker, then loads once", async () => {
    const fetchLog = [];
    const { window, document, errors } = await loadPage("interview.html", { fetchLog, lazy: true });
    await tick(150);
    assert.equal(count(fetchLog), 0, "not requested at load");
    assert.ok(document.querySelectorAll("#appTips li").length > 0, "tips draw without it");
    assert.equal(document.getElementById("aState").options.length, 1);
    const sec = document.getElementById("availability");
    sec.dispatchEvent(new window.Event(ev, { bubbles: true }));
    sec.dispatchEvent(new window.Event(ev, { bubbles: true }));
    await tick(300);
    assert.equal(count(fetchLog), 1, "requested once");
    assert.equal(document.getElementById("aState").options.length, Object.keys(PM.states).length + 1);
    assert.ok(document.getElementById("aAge").options.length > 1);
    document.getElementById("aState").value = "ca"; document.getElementById("aAge").value = "15";
    document.getElementById("aState").dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.match(document.getElementById("aOut").textContent, /hours a week/);
    assert.deepEqual(errors, []);
  });
}

test("interview: a #availability link loads it without a click", async () => {
  const fetchLog = [];
  const { document } = await loadPage("interview.html", { fetchLog, lazy: true, setup: (w) => w.history.replaceState(null, "", "#availability") });
  await tick(300);
  assert.equal(count(fetchLog), 1);
  assert.ok(document.getElementById("aState").options.length > 1);
});

test("interview: a failed fetch shows the existing message", async () => {
  const setup = (w) => { const f = (u, o) => { const url = new URL(String(u), w.location.href); return /permits\.json/.test(url.pathname) ? Promise.reject(new TypeError("down")) : fetch(url, o); }; Object.defineProperty(w, "fetch", { get: () => f, set: () => {}, configurable: true }); };
  const { window, document } = await loadPage("interview.html", { setup, lazy: true });
  await tick(150);
  document.getElementById("availability").dispatchEvent(new window.Event("focusin", { bubbles: true }));
  await tick(300);
  assert.match(document.getElementById("aOut").textContent, /state rules could not load/i);
  assert.match(document.getElementById("aStatus").textContent, /state rules could not load/i);
});
