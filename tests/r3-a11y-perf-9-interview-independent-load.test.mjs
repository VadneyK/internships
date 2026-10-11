// The interview tips must not wait on data/permits.json. Only the weekly checker needs it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

// Replaces the page fetch (dom-helper tries to set it later, this setter ignores that) so permits.json can fail or be slow.
function stub(permits) {
  return (w) => {
    const f = (u, o) => {
      const url = new URL(String(u), w.location.href);
      if (/data\/permits\.json/.test(url.pathname)) return permits(url, o);
      return fetch(url, o);
    };
    Object.defineProperty(w, "fetch", { get: () => f, set: () => {}, configurable: true });
  };
}

test("interview: tips show and one plain sentence appears when permits.json fails", async () => {
  const { document, errors } = await loadPage("interview.html", { setup: stub(() => Promise.reject(new TypeError("network down"))) });
  await tick(150);
  assert.ok(document.querySelectorAll("#appTips li").length > 0, "tips filled");
  assert.match(document.getElementById("evidence").textContent, /did not find one/);
  assert.equal(document.querySelectorAll("#qList textarea").length, 12);
  assert.deepEqual(errors, []);
  const out = document.getElementById("aOut").textContent.trim();
  assert.match(out, /state rules could not load/i);
  assert.equal(document.getElementById("aStatus").textContent.trim(), out);
  assert.equal(document.getElementById("aState").options.length, 1);
});

test("interview: tips are filled before a slow permits.json arrives, then the checker fills in", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { document, errors } = await loadPage("interview.html", { setup: stub((url, o) => gate.then(() => fetch(url, o))) });
  await tick(150);
  assert.ok(document.querySelectorAll("#appTips li").length > 0, "tips filled while permits.json is pending");
  assert.equal(document.getElementById("aState").options.length, 1, "checker not filled yet");
  release(); await tick(300);
  assert.equal(document.getElementById("aState").options.length, Object.keys(PM.states).length + 1);
  assert.deepEqual(errors, []);
});

test("interview: both files load, state list is complete and ?state= and ?age= prefill", async () => {
  const { document, errors } = await loadPage("interview.html", { search: "?state=ca&age=15" });
  await tick(150);
  assert.equal(document.getElementById("aState").options.length, Object.keys(PM.states).length + 1);
  assert.equal(document.getElementById("aState").value, "ca");
  assert.equal(document.getElementById("aAge").value, "15");
  assert.deepEqual(errors, []);
});
