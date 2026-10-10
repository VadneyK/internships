// Run with: node --test tests/r2-teen-flow-2.test.mjs
// Grade phrase used by the playbook message builder ("I'm in 10th grade at ..." / "I'm a sophomore at ...").
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage, type } from "./dom-helper.mjs";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

test("gradePhrase: empty or blank gives the placeholder", () => {
  assert.equal(L.gradePhrase(""), "in [grade]");
  assert.equal(L.gradePhrase("   "), "in [grade]");
  assert.equal(L.gradePhrase(undefined), "in [grade]");
  assert.equal(L.gradePhrase(null), "in [grade]");
});

test("gradePhrase: a bare number from 7 to 12 gets the ordinal suffix", () => {
  assert.equal(L.gradePhrase("7"), "in 7th grade");
  assert.equal(L.gradePhrase("8"), "in 8th grade");
  assert.equal(L.gradePhrase("9"), "in 9th grade");
  assert.equal(L.gradePhrase("10"), "in 10th grade");
  assert.equal(L.gradePhrase("11"), "in 11th grade");
  assert.equal(L.gradePhrase("12"), "in 12th grade");
  assert.equal(L.gradePhrase(" 9 "), "in 9th grade");
});

test("gradePhrase: '10th' and '10th grade' in any case both give 'in 10th grade'", () => {
  assert.equal(L.gradePhrase("10th"), "in 10th grade");
  assert.equal(L.gradePhrase("10th grade"), "in 10th grade");
  assert.equal(L.gradePhrase("10TH GRADE"), "in 10th grade");
  assert.equal(L.gradePhrase("10th Grade"), "in 10th grade");
  assert.equal(L.gradePhrase("9 grade"), "in 9th grade");
});

test("gradePhrase: freshman, sophomore, junior and senior give 'a <word>' in any case", () => {
  assert.equal(L.gradePhrase("freshman"), "a freshman");
  assert.equal(L.gradePhrase("sophomore"), "a sophomore");
  assert.equal(L.gradePhrase("Sophomore"), "a sophomore");
  assert.equal(L.gradePhrase("JUNIOR"), "a junior");
  assert.equal(L.gradePhrase("  senior  "), "a senior");
});

test("gradePhrase: other text ending in the word grade is returned unchanged", () => {
  assert.equal(L.gradePhrase("Eleventh grade"), "in Eleventh grade");
  assert.equal(L.gradePhrase("1st grade"), "in 1st grade");
  assert.equal(L.gradePhrase("twelfth Grade"), "in twelfth Grade");
});

test("gradePhrase: any other text gets ' grade' added", () => {
  assert.equal(L.gradePhrase("Eleventh"), "in Eleventh grade");
  assert.equal(L.gradePhrase("tenth"), "in tenth grade");
});

test("gradePhrase: never produces 'grade grade' for the grades teens usually type", () => {
  for (const raw of ["10th grade", "10th", "10", "sophomore", "Senior grade", "9", "12th grade", "Eleventh grade"]) {
    assert.doesNotMatch(L.gradePhrase(raw), /grade grade/i, raw);
  }
});

test("playbook page: typing a grade builds 'I'm in 10th grade at' and 'I'm a sophomore at' (email format)", async () => {
  const { window, document, errors } = await loadPage("playbook.html");
  assert.deepEqual(errors, []);
  type(window, document.getElementById("fGrade"), "10th grade");
  let letter = document.getElementById("letter").textContent;
  assert.match(letter, /I'm in 10th grade at/);
  assert.doesNotMatch(letter, /grade grade/);
  type(window, document.getElementById("fGrade"), "sophomore");
  letter = document.getElementById("letter").textContent;
  assert.match(letter, /I'm a sophomore at/);
  assert.doesNotMatch(letter, /grade grade/);
});

test("playbook page: the text message format uses the same phrase and never says 'grade grade'", async () => {
  const { window, document } = await loadPage("playbook.html");
  type(window, document.getElementById("fFormat"), "text");
  for (const grade of ["10th grade", "sophomore", "9", "Senior grade"]) {
    type(window, document.getElementById("fGrade"), grade);
    const letter = document.getElementById("letter").textContent;
    assert.doesNotMatch(letter, /grade grade/, grade);
    assert.match(letter, /I'm (in \d+th grade|a \w+) at/, grade);
  }
  type(window, document.getElementById("fGrade"), "10th grade");
  assert.match(document.getElementById("letter").textContent, /I'm in 10th grade at/);
  type(window, document.getElementById("fGrade"), "sophomore");
  assert.match(document.getElementById("letter").textContent, /I'm a sophomore at/);
});

test("playbook page: an empty grade shows the placeholder and 'Says who you are' stays open until grade is filled", async () => {
  const { window, document } = await loadPage("playbook.html");
  type(window, document.getElementById("fTo"), "Mrs. Lee");
  type(window, document.getElementById("fMe"), "Maya");
  type(window, document.getElementById("fSchool"), "Davis High");
  assert.match(document.getElementById("letter").textContent, /I'm in \[grade\] at Davis High/);
  const says = () => [...document.querySelectorAll("#checks li")].find((li) => /Says who you are/.test(li.textContent));
  assert.ok(says() && !says().classList.contains("ok"), "not ok while grade is empty");
  type(window, document.getElementById("fGrade"), "sophomore");
  assert.ok(says().classList.contains("ok"), "ok once grade, name and school are filled");
});
