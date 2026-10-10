import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const SUMMARY = /^About \$[\d,]+\.\d\d left before income tax\.$/;

test("paycheck: the estimate card is not a live region; one hidden status line, empty on load", async () => {
  const { document, errors } = await loadPage("paycheck.html"); await tick(100);
  assert.deepEqual(errors, []);
  const out = document.getElementById("mOut");
  assert.equal(out.hasAttribute("aria-live"), false);
  const st = document.getElementById("mStatus");
  assert.ok(st.classList.contains("sr"));
  assert.equal(st.getAttribute("role"), "status");
  assert.equal(st.textContent, "");
  assert.equal(document.querySelectorAll("#mStatus").length, 1);
});

test("paycheck: after a pause, the status line matches the bold 'Left before income tax' amount", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(100);
  type(window, document.getElementById("mWage"), "15");
  type(window, document.getElementById("mHours"), "10");
  await tick(1000);
  const st = document.getElementById("mStatus").textContent;
  assert.match(st, SUMMARY);
  const bold = [...document.querySelectorAll("#mOut td b")].pop().textContent;
  assert.equal(st.match(/\$([\d,]+\.\d\d)/)[1].replace(/,/g, ""), bold.replace(/[$,]/g, ""));
});

test("paycheck: clearing the rate says to enter a rate and the hours", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(100);
  type(window, document.getElementById("mWage"), "");
  await tick(1000);
  assert.equal(document.getElementById("mStatus").textContent, "Enter a rate and the hours.");
});

test("paycheck: typing four digits quickly changes the status line at most once", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(100);
  const st = document.getElementById("mStatus");
  let changes = 0;
  new window.MutationObserver((records) => { changes += records.filter((r) => r.type === "childList").length; })
    .observe(st, { childList: true, characterData: true, subtree: true });
  const el = document.getElementById("mHours");
  for (const v of ["1", "12", "120", "125"]) { type(window, el, v); await tick(50); }
  await tick(1000);
  assert.ok(changes <= 1, "status changed " + changes + " times");
  assert.match(st.textContent, SUMMARY);
});

test("paycheck: the wrong-pay card keeps its live region, since it only changes on a state change", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(100);
  assert.equal(document.getElementById("mWrong").getAttribute("aria-live"), "polite");
  type(window, document.getElementById("mState"), "il");
  assert.match(document.getElementById("mWrong").textContent, /13 days/);
});
