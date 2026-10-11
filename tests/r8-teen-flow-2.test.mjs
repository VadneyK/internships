// Ticket r1-teen-flow-2 (Jobs): the picked age stays in the address, and both permit buttons carry it.
// Run with: node --test tests/r8-teen-flow-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

function permitHrefs(document) {
  return [document.getElementById("jPermitRules").getAttribute("href"), document.getElementById("jPermitNext").getAttribute("href")];
}

test("jobs ?age=15: both permit buttons go to permit.html?age=15", async () => {
  const { document, errors } = await loadPage("jobs.html", { search: "?age=15" });
  await tick(150);
  assert.equal(document.getElementById("jAge").value, "15");
  assert.deepEqual(permitHrefs(document), ["permit.html?age=15", "permit.html?age=15"]);
  assert.deepEqual(errors, []);
});

test("jobs: changing the age to 17 updates the address and both permit buttons", async () => {
  const { window, document, errors } = await loadPage("jobs.html", { search: "?age=15" });
  await tick(150);
  const historyBefore = window.history.length;
  type(window, document.getElementById("jAge"), "17");
  assert.equal(window.location.search, "?age=17");
  assert.deepEqual(permitHrefs(document), ["permit.html?age=17", "permit.html?age=17"]);
  assert.equal(window.history.length, historyBefore, "replaceState adds no history entry");
  assert.deepEqual(errors, []);
});

test("jobs: picking Under 14 writes ?age=u14 and keeps the permit buttons plain", async () => {
  const { window, document, errors } = await loadPage("jobs.html", { search: "?age=17" });
  await tick(150);
  type(window, document.getElementById("jAge"), "u14");
  assert.equal(window.location.search, "?age=u14");
  assert.deepEqual(permitHrefs(document), ["permit.html", "permit.html"]);
  assert.deepEqual(errors, []);
});

test("jobs: clearing the age removes ?age= and keeps the permit buttons plain", async () => {
  const { window, document, errors } = await loadPage("jobs.html", { search: "?age=16" });
  await tick(150);
  type(window, document.getElementById("jAge"), "");
  assert.equal(window.location.search, "");
  assert.deepEqual(permitHrefs(document), ["permit.html", "permit.html"]);
  assert.deepEqual(errors, []);
});

test("jobs with no age: permit buttons are plain permit.html", async () => {
  const { document, errors } = await loadPage("jobs.html");
  await tick(150);
  assert.deepEqual(permitHrefs(document), ["permit.html", "permit.html"]);
  assert.deepEqual(errors, []);
});
