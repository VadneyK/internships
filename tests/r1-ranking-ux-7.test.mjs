// The one line under the count that says how the Programs list is ordered (p#sortNote).
// Run with: node --test tests/r1-ranking-ux-7.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const BEST_HEAD = "Ordered by: open programs due within 3 weeks first, then other open programs with a deadline, then open programs with no deadline, then the rest. Inside each group, paid, stipend or mixed comes first, then unpaid or pay not stated, then programs that cost money.";
const BEST = BEST_HEAD + " Then the nearest deadline.";
const BEST_AGE = BEST_HEAD + " Then programs that state an age range that fits age 15, then the nearest deadline.";
const DEADLINE = "Ordered by: soonest deadline first, then everything else.";
const NAME = "Ordered by: A to Z.";
const DASH = new RegExp("[" + String.fromCharCode(0x2012, 0x2013, 0x2014, 0x2015) + "]"); // figure dash, en dash, em dash, horizontal bar

test("default load shows the best-next-step line, with no age sentence", async () => {
  const { window, document, errors } = await loadPage("find.html");
  try {
    const note = document.getElementById("sortNote");
    assert.ok(note, "p#sortNote exists after load");
    assert.equal(note.tagName, "P");
    assert.equal(note.className, "small muted");
    assert.equal(note.textContent, BEST);
    assert.equal(document.querySelectorAll("#sortNote").length, 1);
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test("choosing age 15 adds the age sentence with 15 in it", async () => {
  const { window, document, errors } = await loadPage("find.html");
  try {
    type(window, document.getElementById("age"), "15");
    await tick();
    const text = document.getElementById("sortNote").textContent;
    assert.equal(text, BEST_AGE);
    assert.ok(text.includes("age 15"));
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test("the age sentence is not added for the deadline or name sorts", async () => {
  const { window, document, errors } = await loadPage("find.html");
  try {
    type(window, document.getElementById("age"), "15");
    await tick();
    type(window, document.getElementById("sort"), "deadline");
    await tick();
    assert.equal(document.getElementById("sortNote").textContent, DEADLINE);
    type(window, document.getElementById("sort"), "name");
    await tick();
    assert.equal(document.getElementById("sortNote").textContent, NAME);
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test("switching the sort select to deadline and name changes the line", async () => {
  const { window, document, errors } = await loadPage("find.html");
  try {
    const sort = document.getElementById("sort");
    type(window, sort, "deadline");
    await tick();
    assert.equal(document.getElementById("sortNote").textContent, DEADLINE);
    type(window, sort, "name");
    await tick();
    assert.equal(document.getElementById("sortNote").textContent, NAME);
    type(window, sort, "best");
    await tick();
    assert.equal(document.getElementById("sortNote").textContent, BEST);
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test("the By deadline view still shows the line", async () => {
  const { window, document, errors } = await loadPage("find.html");
  try {
    document.getElementById("viewDates").click();
    await tick();
    const note = document.getElementById("sortNote");
    assert.equal(document.getElementById("dates").hidden, false);
    assert.equal(note.hidden, false);
    assert.equal(note.textContent, BEST);
    type(window, document.getElementById("sort"), "deadline");
    await tick();
    assert.equal(note.textContent, DEADLINE);
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test("the line sits right after the toolbar, the id is unique, and it has no dash characters", async () => {
  const { window, document, errors } = await loadPage("find.html");
  try {
    type(window, document.getElementById("age"), "14");
    await tick();
    type(window, document.getElementById("sort"), "deadline");
    await tick();
    type(window, document.getElementById("sort"), "best");
    await tick();
    const notes = document.querySelectorAll("#sortNote");
    assert.equal(notes.length, 1, "one element with the id, after many renders");
    const note = notes[0];
    assert.ok(note.previousElementSibling && note.previousElementSibling.classList.contains("toolbar"));
    assert.ok(note.previousElementSibling.contains(document.getElementById("count")));
    assert.equal(DASH.test(note.textContent), false);
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});
