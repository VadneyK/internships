// Run with: node --test tests/r3-teen-flow-3.test.mjs
// Paycheck: a teen outside the four states can use the estimate with their own rate.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("paycheck: Another state works with a typed rate and shows only Social Security and Medicare", async () => {
  const p = await loadPage("paycheck.html"); await tick(200);
  const { window, document } = p;
  const opt = [...document.querySelectorAll("#mPreset option")].find((o) => o.value === "other");
  assert.ok(opt, "other option exists");
  assert.equal(opt.textContent, "Another state (type your own rate)");
  type(window, document.getElementById("mPreset"), "other");
  assert.equal(document.getElementById("mWage").value, "");
  assert.match(document.getElementById("mOut").textContent, /Enter a rate and the hours\./);
  const note = document.getElementById("mOther");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /Social Security and Medicare/);
  assert.ok([...note.querySelectorAll("a")].some((a) => a.getAttribute("href") === "permit.html"));
  type(window, document.getElementById("mWage"), "10");
  type(window, document.getElementById("mHours"), "10");
  const rows = [...document.querySelectorAll("#mOut tbody tr")].map((r) => r.textContent);
  assert.match(rows[0], /\$100\.00/);
  assert.equal(rows.filter((r) => /^[−−]/.test(r) || /Social Security|Medicare|SDI|disability|leave/i.test(r)).length, 2);
  assert.ok(rows.some((r) => /Social Security/.test(r)) && rows.some((r) => /Medicare/.test(r)));
  assert.doesNotMatch(document.getElementById("mOut").textContent, /SDI|PFL|Paid Family/);
  assert.deepEqual(p.errors, []);
});

test("paycheck: existing presets still work, the note hides, and ?state=ny preselects New York", async () => {
  const p = await loadPage("paycheck.html"); await tick(200);
  const { window, document } = p;
  type(window, document.getElementById("mPreset"), "other");
  type(window, document.getElementById("mPreset"), "ga");
  assert.equal(document.getElementById("mOther").hidden, true);
  assert.equal(document.getElementById("mWage").value, "7.25");
  assert.match(document.getElementById("mOut").textContent, /\$80\.35/);
  const q = await loadPage("paycheck.html", { search: "?state=ny" }); await tick(200);
  assert.match(q.document.getElementById("mPreset").value, /^ny-/);
  assert.equal(q.document.getElementById("mState").value, "ny");
  assert.deepEqual(q.errors, []);
});

test("paycheck: the hours label is plain", async () => {
  const { document } = await loadPage("paycheck.html"); await tick(100);
  assert.equal(document.querySelector('label[for="mHours"]').textContent, "Hours on this paycheck");
});
