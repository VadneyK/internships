// Jobs reads data/permits.json only after an age of 14 to 17 and a state are both picked, and only once.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

const count = (log) => log.filter((r) => /data\/permits\.json/.test(r.url)).length;

test("jobs: permits.json is not fetched at load, for no state, under 14, or 18", async () => {
  const log = [];
  const { window, document } = await loadPage("jobs.html", { fetchLog: log }); await tick(150);
  assert.equal(count(log), 0);
  type(window, document.getElementById("jAge"), "15"); await tick(80);
  assert.equal(count(log), 0, "age with no state");
  type(window, document.getElementById("jAge"), "u14");
  type(window, document.getElementById("jState"), "OH"); await tick(80);
  assert.equal(count(log), 0, "under 14");
  type(window, document.getElementById("jAge"), "18"); await tick(80);
  assert.equal(count(log), 0, "18");
});

test("jobs: age 15 plus a state fetches permits once, shows the hours, and a second state does not refetch", async () => {
  const log = [];
  const { window, document } = await loadPage("jobs.html", { fetchLog: log }); await tick(150);
  type(window, document.getElementById("jAge"), "15");
  type(window, document.getElementById("jState"), "OH"); await tick(200);
  assert.equal(count(log), 1);
  assert.match(document.getElementById("jHoursBox").textContent, /Hours in Ohio at 15/);
  type(window, document.getElementById("jState"), "TX"); await tick(100);
  assert.equal(count(log), 1);
  assert.match(document.getElementById("jHoursBox").textContent, /Texas/);
});

test("jobs: if permits.json fails, the strip links to the permit finder and the status says so", async () => {
  const log = [];
  const { window, document } = await loadPage("jobs.html", {
    fetchLog: log,
    setup(w) { let real; Object.defineProperty(w, "fetch", { configurable: true, get: () => (u, i) => /permits\.json/.test(String(u)) ? Promise.reject(new Error("down")) : real(u, i), set: (f) => { real = f; } }); },
  }); await tick(150);
  type(window, document.getElementById("jAge"), "15");
  type(window, document.getElementById("jState"), "OH"); await tick(200);
  assert.ok(document.querySelector('#jHoursBox a[href^="permit.html"]'));
  assert.match(document.getElementById("jStatus").textContent, /could not load/);
});
