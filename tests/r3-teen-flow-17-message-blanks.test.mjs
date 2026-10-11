import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("interview thank-you note: blank form names [name], filled form hides the note", async () => {
  const { window, document } = await loadPage("interview.html"); await tick();
  const note = document.getElementById("tBlankNote");
  assert.equal(note.getAttribute("role"), "status");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /\[name\]/);
  assert.match(note.textContent, /\[your first name\]/);
  assert.match(document.getElementById("tMail").href, /^mailto:/);
  const f = { tTo: "Ms. Lee", tJob: "cashier", tHelp: "I can work weekends", tName: "Sam" };
  for (const id in f) type(window, document.getElementById(id), f[id]);
  assert.equal(note.hidden, true);
});

test("permit message: shows [your first name] and [the employer], typing hides it", async () => {
  const { window, document } = await loadPage("permit.html"); await tick();
  type(window, document.getElementById("pState"), "ca");
  type(window, document.getElementById("pAge"), "15");
  type(window, document.getElementById("pKind"), "job"); await tick();
  const note = document.getElementById("mBlankNote");
  assert.equal(note.getAttribute("role"), "status");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /\[your first name\]/);
  assert.match(note.textContent, /\[the employer\]/);
  assert.match(document.getElementById("mMail").href, /^mailto:/);
  type(window, document.getElementById("mName"), "Sam");
  type(window, document.getElementById("mEmp"), "the city pool");
  assert.equal(note.hidden, true);
});
