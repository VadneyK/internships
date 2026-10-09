import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, type, tick } from "./dom-helper.mjs";
import { createRequire } from "node:module";
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

test("hoursCheck: California 14 year old in school, long days and a long week are flagged, a modest plan is not", () => {
  const ca = PM.states.ca.limits;
  const mon = { from: 15, to: 19 };            // 4 hours on a school day, limit 3
  const r = L.hoursCheck(ca, 14, true, [mon, null, null, null, null, { from: 9, to: 17 }, null]);
  assert.equal(r.total, 12);
  assert.ok(r.problems.some((p) => /Monday: 4 hours is more than the 3 hour limit/.test(p)));
  const ok = L.hoursCheck(ca, 14, true, [{ from: 15, to: 18 }, null, null, null, null, { from: 9, to: 17 }, null]);
  assert.deepEqual(ok.problems, []);
  const late = L.hoursCheck(ca, 15, true, [{ from: 17, to: 20 }, null, null, null, null, null, null]);
  assert.ok(late.problems.some((p) => /past 7 p\.m\./.test(p)));
  const summer = L.hoursCheck(ca, 15, false, [{ from: 17, to: 20 }, null, null, null, null, null, null]);
  assert.deepEqual(summer.problems, [], "9 p.m. is allowed in summer");
  const week = L.hoursCheck(ca, 14, false, [0, 1, 2, 3, 4, 5, 6].map(() => ({ from: 9, to: 15 })));
  assert.ok(week.problems.some((p) => /42 hours.*40 hour limit/.test(p)));
});

test("hoursCheck: no limit at 16 in Georgia and Illinois, NY 16 year old has weekday and weekly caps, bad input is safe", () => {
  assert.equal(L.hoursCheck(PM.states.ga.limits, 16, true, [{ from: 8, to: 20 }, null, null, null, null, null, null]).limited, false);
  assert.equal(L.hoursCheck(PM.states.il.limits, 17, true, [{ from: 8, to: 20 }, null, null, null, null, null, null]).limited, false);
  const ny = L.hoursCheck(PM.states.ny.limits, 16, true, [{ from: 15, to: 20 }, null, null, null, { from: 15, to: 22 }, null, null]);
  assert.ok(ny.problems.some((p) => /Monday: 5 hours is more than the 4 hour/.test(p)));
  assert.ok(!ny.problems.some((p) => /Friday/.test(p)), "Friday is not a limited school night in New York");
  assert.equal(L.hoursCheck(null, 15, true, [null, null, null, null, null, null, null]).total, 0);
  assert.equal(L.hoursCheck(PM.states.ca.limits, "", true, []).limited, false);
});

test("interview: loads clean, plans availability against the limits, saves notes, builds a thank-you note and a references ask", async () => {
  const p = await loadPage("interview.html"); await tick(150);
  const { window, document } = p;
  assert.deepEqual(p.errors, []);
  assert.equal(document.querySelectorAll("#qList textarea").length, 12);
  assert.match(document.getElementById("evidence").textContent, /did not find one/);
  type(window, document.getElementById("aAge"), "14");
  type(window, document.getElementById("aState"), "ca");
  type(window, document.querySelector('[data-d="0"][data-k="from"]'), "15");
  type(window, document.querySelector('[data-d="0"][data-k="to"]'), "19");
  assert.match(document.getElementById("aOut").textContent, /Heads up/);
  assert.match(document.getElementById("aOut").textContent, /Monday: 4 hours/);
  type(window, document.querySelector('[data-d="0"][data-k="to"]'), "18");
  assert.match(document.getElementById("aOut").textContent, /Within the limits/);
  const q0 = document.getElementById("q0"); type(window, q0, "I like robotics and I volunteer at the library");
  const again = await loadPage("interview.html", { storage: { interview: { q: { 0: "kept note" }, refs: [], av: {} } } }); await tick(150);
  assert.equal(again.document.getElementById("q0").value, "kept note");
  type(window, document.getElementById("tTo"), "Ms. Lee"); type(window, document.getElementById("tJob"), "pool cashier"); type(window, document.getElementById("tHelp"), "I can work weekends");
  assert.match(document.getElementById("tText").textContent, /Ms\. Lee/);
  assert.match(document.getElementById("tText").textContent, /pool cashier/);
  assert.match(document.getElementById("tMail").href, /^mailto:/);
  assert.equal(document.querySelectorAll("#refRows article").length, 4);
  assert.doesNotMatch(document.body.textContent, /undefined|NaN/);
});

test("interview: sits under the Resume nav item and every source link is https", async () => {
  const { document } = await loadPage("interview.html"); await tick(150);
  assert.equal(document.querySelectorAll('nav a[aria-current="page"]').length, 1);
  assert.match(document.querySelector('nav a[aria-current="page"]').textContent, /Resume/);
  for (const a of document.querySelectorAll("#qList a, #askSrc a, #appSrc a")) assert.match(a.href, /^https:\/\//);
});
