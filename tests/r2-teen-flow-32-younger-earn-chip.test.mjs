import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("r2-teen-flow-32: first chip in the page nav is Work near home, linking to #earn", async () => {
  const { document, errors } = await loadPage("younger.html"); await tick(200);
  assert.deepEqual(errors, []);
  const nav = document.querySelector("nav#parts");
  assert.ok(nav, "nav#parts exists");
  const chips = [...nav.querySelectorAll("a.chip")];
  assert.equal(chips[0].textContent.trim(), "Work near home");
  assert.equal(chips[0].getAttribute("href"), "#earn");
});

test("r2-teen-flow-32: the existing numbered chips keep their labels", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  const labels = [...document.querySelectorAll("nav#parts a.chip")].map((a) => a.textContent.trim());
  assert.deepEqual(labels, [
    "Work near home",
    "1. At my age",
    "2. Stay safe",
    "3. Path to a job",
    "4. Money facts",
    "Words you will see",
  ]);
});

test("r2-teen-flow-32: the earn target exists once and the near-home block sits inside it", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  assert.equal(document.querySelectorAll("#earn").length, 1);
  const earn = document.getElementById("earn");
  const near = document.getElementById("near");
  assert.ok(near, "near block exists");
  assert.ok(earn.contains(near), "#near is inside #earn");
  assert.equal(earn.tagName, "SECTION");
});
