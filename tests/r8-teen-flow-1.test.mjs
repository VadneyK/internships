import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

test("jobs: age 16 shows a Job groups chip row that jumps to each group and counts every card", async () => {
  const { window, document, errors } = await loadPage("jobs.html"); await tick(150);
  assert.equal(document.querySelector('nav[aria-label="Job groups"]'), null, "no chips before an age");
  type(window, document.getElementById("jAge"), "16");
  const chips = [...document.querySelectorAll('#jChips nav.chips[aria-label="Job groups"] a')];
  const heads = [...document.querySelectorAll("#jOut > h2")];
  assert.ok(chips.length >= 2);
  assert.equal(chips.length, heads.length);
  let total = 0;
  chips.forEach((a, i) => {
    const el = document.getElementById(a.getAttribute("href").slice(1));
    assert.ok(el, "target exists for " + a.textContent);
    assert.equal(el, heads[i]);
    assert.equal(el.getAttribute("tabindex"), "-1");
    const n = a.querySelector(".n");
    assert.ok(a.textContent.trim().endsWith(n.textContent));
    assert.equal(a.textContent.replace(n.textContent, ""), el.textContent);
    total += Number(n.textContent);
  });
  assert.equal(total, document.querySelectorAll("#jOut > .grid .card").length);
  type(window, document.getElementById("jAge"), "14");
  const c14 = document.querySelectorAll("#jChips nav.chips a");
  assert.equal(c14.length, document.querySelectorAll("#jOut > h2").length);
  type(window, document.getElementById("jAge"), "u14");
  assert.equal(document.querySelector("#jChips nav.chips"), null);
  assert.deepEqual(errors, []);
});
