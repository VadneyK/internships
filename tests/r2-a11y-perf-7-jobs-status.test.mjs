import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

test("jobs status: empty on load and after the blank choice; names the employer and group counts after an age", async () => {
  const { window, document, errors } = await loadPage("jobs.html"); await tick(150);
  assert.equal(document.getElementById("jStatus").textContent, "");
  type(window, document.getElementById("jAge"), "16");
  const status = document.getElementById("jStatus").textContent;
  assert.match(status, /\d+ employers? for age 16/);
  const groups = document.querySelectorAll("#jOut h2").length;
  assert.ok(groups >= 1, "at least one group heading");
  assert.ok(status.includes(" in " + groups + " job group"), "status names " + groups + " job groups: " + status);
  const summary = document.querySelector("#jOut > details:not(.jOld) summary").textContent;
  assert.match(summary, /\d+ employers that start older than 16/);
  assert.match(summary, /older/);
  type(window, document.getElementById("jAge"), "");
  assert.equal(document.getElementById("jStatus").textContent, "");
  assert.deepEqual(errors, []);
});

test("jobs status: under 14 says under 14", async () => {
  const { window, document } = await loadPage("jobs.html"); await tick(150);
  type(window, document.getElementById("jAge"), "u14");
  assert.match(document.getElementById("jStatus").textContent, /under 14/);
});
