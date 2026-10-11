// Ticket r3-a11y-perf-12: the paycheck page names the field that is wrong, instead of one generic line.
// Run with: node --test tests/r3-a11y-perf-12-paycheck-field-errors.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const GENERIC = "Enter a rate and the hours.";
const SUMMARY = /^About \$[\d,]+\.\d\d left before income tax\.$/;

function describedTargetsResolve(document) {
  for (const el of document.querySelectorAll("[aria-describedby]")) {
    for (const id of el.getAttribute("aria-describedby").split(/\s+/).filter(Boolean)) {
      assert.ok(document.getElementById(id), "aria-describedby of #" + el.id + " points at missing #" + id);
    }
  }
}

test("paycheck: a negative rate flags only the rate, with a note that names it", async () => {
  const { window, document, errors } = await loadPage("paycheck.html"); await tick(100);
  assert.deepEqual(errors, []);
  type(window, document.getElementById("mHours"), "10");
  type(window, document.getElementById("mWage"), "-5");
  const wage = document.getElementById("mWage");
  assert.equal(wage.getAttribute("aria-invalid"), "true");
  const noteId = wage.getAttribute("aria-describedby");
  assert.ok(noteId);
  const note = document.getElementById(noteId);
  assert.ok(note, "described-by note exists");
  assert.match(note.textContent, /rate/i);
  assert.equal(note.hidden, false);
  const hours = document.getElementById("mHours");
  assert.equal(hours.hasAttribute("aria-invalid"), false);
  assert.equal(hours.hasAttribute("aria-describedby"), false);
  describedTargetsResolve(document);
  assert.doesNotMatch(document.getElementById("mOut").textContent, new RegExp(GENERIC));
  await tick(600);
  const st = document.getElementById("mStatus").textContent;
  assert.notEqual(st, GENERIC);
  assert.match(st, /^The hourly rate can not be below 0\.$/);
});

test("paycheck: a blank hours field flags only hours, and says to enter hours", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(100);
  type(window, document.getElementById("mWage"), "15");
  type(window, document.getElementById("mHours"), "");
  const hours = document.getElementById("mHours");
  assert.equal(hours.getAttribute("aria-invalid"), "true");
  const note = document.getElementById(hours.getAttribute("aria-describedby"));
  assert.ok(note);
  assert.match(note.textContent, /enter the hours/i);
  const wage = document.getElementById("mWage");
  assert.equal(wage.hasAttribute("aria-invalid"), false);
  assert.equal(wage.hasAttribute("aria-describedby"), false);
  describedTargetsResolve(document);
  await tick(600);
  const st = document.getElementById("mStatus").textContent;
  assert.match(st, /hours/i);
  assert.notEqual(st, GENERIC);
});

test("paycheck: fixing both fields clears aria-invalid, the notes, and shows the table", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(100);
  type(window, document.getElementById("mWage"), "-5");
  type(window, document.getElementById("mHours"), "");
  type(window, document.getElementById("mWage"), "15");
  type(window, document.getElementById("mHours"), "10");
  for (const id of ["mWage", "mHours"]) {
    const el = document.getElementById(id);
    assert.equal(el.hasAttribute("aria-invalid"), false, id + " has aria-invalid");
    assert.equal(el.hasAttribute("aria-describedby"), false, id + " has aria-describedby");
    assert.notEqual(el.getAttribute("aria-invalid"), "false");
  }
  for (const id of ["mWageNote", "mHoursNote"]) {
    assert.equal(document.getElementById(id).textContent, "", id + " keeps old text");
    assert.equal(document.getElementById(id).hidden, true, id + " is still shown");
  }
  assert.ok(document.querySelector("#mOut table"), "the paycheck table appears");
  assert.doesNotMatch(document.getElementById("mOut").textContent, new RegExp(GENERIC));
  await tick(600);
  assert.match(document.getElementById("mStatus").textContent, SUMMARY);
});

test("paycheck: the status line names the flagged field after the debounce, not the generic line", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(100);
  type(window, document.getElementById("mHours"), "10");
  type(window, document.getElementById("mWage"), "");
  await tick(600);
  const st = document.getElementById("mStatus").textContent;
  assert.notEqual(st, GENERIC);
  assert.match(st, /hourly rate/i);
});
