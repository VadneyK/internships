// Ticket p8-younger-state: when the picked state is not one of the four grid states, one plain line sits right above the grid.
// The line names the picked state and points to its short card, which now sits below the table.
// Run with: node --test tests/p8-younger-state.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const FOUR = "This table covers California, Georgia, New York and Illinois only.";

function pick(window, document, v) {
  const ys = document.getElementById("yState");
  ys.value = v;
  ys.dispatchEvent(new window.Event("change", { bubbles: true }));
}

test("p8-younger-state: pick Montana, the line appears with Montana in it", async () => {
  const { document, window, errors } = await loadPage("younger.html"); await tick(150);
  pick(window, document, "mt"); await tick(60);
  const note = document.getElementById("gridNote");
  assert.equal(note.hidden, false, "the line is shown");
  assert.equal(note.textContent, FOUR + " For Montana, see the short answer below and the federal rules.");
  assert.deepEqual(errors, []);
});

test("p8-younger-state: pick California, the line does not appear", async () => {
  const { document, window, errors } = await loadPage("younger.html"); await tick(150);
  pick(window, document, "ca"); await tick(60);
  const note = document.getElementById("gridNote");
  assert.equal(note.hidden, true, "the line is hidden");
  assert.equal(note.textContent, "");
  assert.doesNotMatch(document.body.textContent, /This table covers/);
  assert.deepEqual(errors, []);
});

test("p8-younger-state: the line is right above the grid table", async () => {
  const { document } = await loadPage("younger.html"); await tick(150);
  const note = document.getElementById("gridNote");
  const wrap = document.getElementById("gridT").closest(".tablewrap");
  assert.equal(note.nextElementSibling, wrap, "the line comes directly before the table wrapper");
  assert.equal(wrap.querySelectorAll("thead th").length, 5, "the grid still has all four states plus the row label");
});

test("p8-younger-state: the short card for Montana sits below the grid, so the line can point to it", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(150);
  pick(window, document, "mt"); await tick(60);
  const card = document.getElementById("otherLite");
  const table = document.getElementById("gridT");
  assert.ok(table.compareDocumentPosition(card) & 4, "the card comes after the table");
});

test("p8-younger-state: a state from the address (?state=mt) shows the line on load", async () => {
  const { document, errors } = await loadPage("younger.html", { search: "?state=mt" }); await tick(200);
  const note = document.getElementById("gridNote");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /For Montana, see the short answer below/);
  assert.deepEqual(errors, []);
});

test("p8-younger-state: a work permit state (Texas) also gets the line with its name", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(150);
  pick(window, document, "tx"); await tick(60);
  const note = document.getElementById("gridNote");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /For Texas, see the short answer below/);
});

test("p8-younger-state: going from Montana to California hides the line, and All four states hides it too", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(150);
  const note = document.getElementById("gridNote");
  pick(window, document, "mt"); await tick(40);
  assert.equal(note.hidden, false);
  pick(window, document, "ca"); await tick(40);
  assert.equal(note.hidden, true, "California hides the line");
  pick(window, document, "mt"); await tick(40);
  pick(window, document, ""); await tick(40);
  assert.equal(note.hidden, true, "All four states hides the line");
  assert.equal(note.textContent, "");
});

test("p8-younger-state: no pick on first load shows no line", async () => {
  const { document } = await loadPage("younger.html"); await tick(150);
  assert.equal(document.getElementById("gridNote").hidden, true);
});
