// r5-younger-1: sitting and pet care safety cards, address-safe neighbor script, unknown chips in the state grid.
// Run with: node --test tests/r5-teen-flow-14-younger-pets.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("r5-younger-1: sitting card has the five tips and the label", async () => {
  const { document, errors } = await loadPage("younger.html"); await tick(200);
  assert.deepEqual(errors, []);
  assert.equal(document.getElementById("sitH").textContent, "First visit rules for sitting jobs");
  assert.equal(document.getElementById("sitLabel").textContent, "Safety tips, not the law");
  const t = document.getElementById("sitCard").textContent;
  for (const w of ["meets the family at their home", "address and the family", "how often", "call a parent or 911", "where the adult is"]) assert.ok(t.includes(w), w);
  assert.equal(document.querySelectorAll("#sitL li").length, 5);
});

test("r5-younger-1: pet care card says no page names pet care and sends a parent to the state labor office", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  assert.equal(document.getElementById("petLabel").textContent, "Safety tips, not the law");
  const n = document.getElementById("petNote").textContent;
  assert.match(n, /babysitting is not covered/);
  assert.match(n, /No page we read names pet care/);
  assert.match(n, /state labor office/);
  const t = document.getElementById("petCard").textContent;
  for (const w of ["owner and the pet", "vet and emergency", "walk dogs you can control", "house key"]) assert.ok(t.includes(w), w);
  assert.equal(document.querySelectorAll("#petL li").length, 4);
});

test("r5-younger-1: neighbor script gives no house number", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  const s = document.getElementById("nearScript").textContent;
  assert.match(s, /\[your first name\]/);
  assert.match(s, /\[street name\]/);
  assert.match(s, /\[parent phone number\]/);
  assert.doesNotMatch(s, /house number/i);
  assert.doesNotMatch(s, /\[your name\]/);
});

test("r5-younger-1: Not stated cells render as a muted chip, not plain text", async () => {
  const { document } = await loadPage("younger.html"); await tick(200);
  const chips = [...document.querySelectorAll("#gridT td .tag.ghost")];
  assert.ok(chips.length >= 7, "got " + chips.length);
  for (const c of chips) assert.equal(c.textContent, "Unknown, ask a parent to call");
  assert.ok(!/Not stated on the pages we read/.test(document.getElementById("gridT").textContent));
});
