import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadPage, type, tick } from "./dom-helper.mjs";
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const M = JSON.parse(fs.readFileSync(new URL("../data/money.json", import.meta.url), "utf8"));

test("paycheck math matches the worked examples from the sources, one rounded line at a time", () => {
  const ca = L.paycheck(M, "ca", 16.9, 12, false);
  assert.equal(ca.gross, 202.8);
  assert.deepEqual(ca.lines.map((l) => [l.key, l.amount]), [["ss", 12.57], ["medicare", 2.94], ["sdi", 2.64]]);
  assert.equal(ca.left, 184.65);
  assert.equal(L.paycheck(M, "ga", 7.25, 12, false).left, 80.35);
  const up = L.paycheck(M, "ny-up", 16, 12, false);
  assert.equal(up.left, 176.49);
  assert.equal(up.possibleDisability, 0.6);
  assert.equal(L.paycheck(M, "ny-nyc", 17, 12, false).left, 187.51);
  assert.equal(L.paycheck(M, "il-youth", 13, 12, false).left, 144.07);
  assert.equal(L.paycheck(M, "il-adult", 15, 12, false).left, 166.23);
  const par = L.paycheck(M, "ca", 16.9, 12, true);
  assert.deepEqual(par.lines.map((l) => l.key), ["sdi"], "a parent's sole proprietorship skips Social Security and Medicare");
  assert.equal(L.paycheck(M, "ca", "", 12, false), null);
  assert.equal(L.paycheck(M, "zz", 10, 10, false), null);
});

test("paycheck page: loads clean, estimates, switches state, and shows the form traps and wage help", async () => {
  const p = await loadPage("paycheck.html"); await tick(200);
  const { window, document } = p;
  assert.deepEqual(p.errors, []);
  assert.match(document.getElementById("mOut").textContent, /\$184\.65/);
  type(window, document.getElementById("mPreset"), "ga");
  assert.match(document.getElementById("mOut").textContent, /\$80\.35/);
  assert.equal(document.getElementById("mWage").value, "7.25");
  type(window, document.getElementById("mHours"), "20");
  assert.match(document.getElementById("mOut").textContent, /\$145\.00/);
  assert.match(document.getElementById("mForms").textContent, /did not file last year|did not file a Georgia|filed a Georgia return last year/);
  assert.equal(document.querySelectorAll("#mForms article").length, 5);
  type(window, document.getElementById("mState"), "il");
  assert.match(document.getElementById("mWrong").textContent, /13 days/);
  document.getElementById("mParent").click();
  assert.match(document.getElementById("mOut").textContent, /parent's own unincorporated business/);
  for (const a of document.querySelectorAll("#mForms a, #mWrong a, #mSrc a")) assert.match(a.href, /^https:\/\//);
  assert.doesNotMatch(document.body.textContent, /undefined|NaN/);
});

test("paycheck page: sits under Get ready", async () => {
  const { document } = await loadPage("paycheck.html"); await tick(100);
  assert.match(document.querySelector('nav a[aria-current="page"]').textContent, /Get ready/);
});
