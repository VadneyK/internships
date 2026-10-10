// Run with: node --test tests/r3-teen-flow-4.test.mjs
// Interview hours planner: copy Monday to Tuesday through Friday, clear all, and say who the ages are for.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const sel = (d, i, k) => d.querySelector('[data-d="' + i + '"][data-k="' + k + '"]');
function set(d, el, v) { el.value = v; el.dispatchEvent(new d.defaultView.Event("change", { bubbles: true })); }

test("interview: Monday copies to Tuesday through Friday, clear resets all 14", async () => {
  const p = await loadPage("interview.html"); await tick(150);
  const d = p.document;
  assert.deepEqual(p.errors, []);
  set(d, sel(d, 0, "from"), "15"); set(d, sel(d, 0, "to"), "18");
  d.getElementById("aMon").click(); await tick(50);
  for (let i = 1; i <= 4; i++) { assert.equal(sel(d, i, "from").value, "15"); assert.equal(sel(d, i, "to").value, "18"); }
  assert.equal(sel(d, 5, "from").value, ""); assert.equal(sel(d, 6, "to").value, "");
  assert.match(d.getElementById("aOut").textContent, /15 hours a week offered/);
  d.getElementById("aClear").click(); await tick(50);
  assert.match(d.getElementById("aOut").textContent, /0 hours a week offered/);
  d.querySelectorAll("#aRows select").forEach((s) => assert.equal(s.value, ""));
  assert.equal(d.querySelectorAll("#aRows select").length, 14);
  assert.deepEqual(p.errors, []);
});

test("interview: empty Monday changes nothing and shows a toast", async () => {
  const p = await loadPage("interview.html"); await tick(150);
  const d = p.document;
  set(d, sel(d, 1, "from"), "9"); set(d, sel(d, 1, "to"), "12");
  d.getElementById("aMon").click(); await tick(50);
  assert.equal(sel(d, 1, "from").value, "9"); assert.equal(sel(d, 2, "from").value, "");
  assert.match(d.getElementById("toast").textContent, /Set Monday first/);
  assert.deepEqual(p.errors, []);
});

test("interview: the ages note links to younger.html", async () => {
  const p = await loadPage("interview.html"); await tick(150);
  const a = [...p.document.querySelectorAll("#availability a")].find((x) => x.getAttribute("href") === "younger.html");
  assert.ok(a);
  assert.match(p.document.getElementById("availability").textContent, /The hour check covers ages 14 to 17\. Younger\? See Ages 12 to 14\./);
});
