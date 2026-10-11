import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage, type, tick } from "./dom-helper.mjs";

const L = createRequire(import.meta.url)("../assets/js/lib.js");

test("blanksLeft: bracketed words, underscores, plain text, empty", () => {
  assert.deepEqual(L.blanksLeft("Hi [their name], this is [your name]. [their name]"), ["[their name]", "[your name]"]);
  assert.deepEqual(L.blanksLeft("My mom, ____, works with you."), ["____"]);
  assert.deepEqual(L.blanksLeft("A snake_case and a__b are fine."), []);
  assert.deepEqual(L.blanksLeft("Hi Mrs. Lee, this is Maya."), []);
  assert.deepEqual(L.blanksLeft(""), []);
});

test("playbook blanks: empty page names the blanks, filled page hides the note", async () => {
  const { window, document } = await loadPage("playbook.html");
  const note = document.getElementById("blankNote");
  assert.equal(note.getAttribute("role"), "status");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /^Fill in before you send: /);
  assert.match(note.textContent, /\[their name\]/);
  assert.match(note.textContent, /\[your name\]/);
  assert.equal(document.getElementById("copyMsg").disabled, false);
  const f = { fTo: "Mrs. Lee", fMe: "Maya", fGrade: "10th", fSchool: "Davis High", fHow: "I know your son.", fCurious: "dentistry" };
  for (const id in f) type(window, document.getElementById(id), f[id]);
  assert.equal(note.hidden, true);
});

test("playbook blanks: parent chip shows the ____ blank until edited", async () => {
  const { window, document } = await loadPage("playbook.html");
  const f = { fTo: "Mrs. Lee", fMe: "Maya", fGrade: "10th", fSchool: "Davis High", fHow: "I know your son.", fCurious: "dentistry" };
  for (const id in f) type(window, document.getElementById(id), f[id]);
  const note = document.getElementById("blankNote");
  assert.equal(note.hidden, true);
  document.querySelector('[data-how="0"]').click();
  await tick();
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /____/);
  type(window, document.getElementById("fHow"), "My mom, Priya, works with you.");
  assert.equal(note.hidden, true);
});
