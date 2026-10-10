// Ticket r2-teen-flow-5: an empty "My list" explains how to save a program, not "try a different age or area".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LITE = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries-lite.json"), "utf8"));
const OLD_PHRASE = "Try a different age or area";
const EMPTY_HEAD = "Your list is empty";
const EMPTY_TEXT = "Tap the star on a program card to save it here. Your list stays on this device.";

// find.js loads the programs with fetch, then renders; wait until the count label is no longer "Loading".
async function loadFind(storage = {}) {
  const p = await loadPage("find.html", { storage });
  for (let i = 0; i < 80 && /Loading/.test(p.document.getElementById("count").textContent); i++) await tick(25);
  return p;
}
const cardCount = (doc) => doc.querySelectorAll("article.prog").length;
const pressed = (el) => el.getAttribute("aria-pressed") === "true";

test("r2-teen-flow-5: empty My list with nothing saved shows the how-to-save card, not the filter advice", async () => {
  const { document, errors } = await loadFind({});
  document.getElementById("savedOnly").click();
  await tick();
  const out = document.getElementById("out");
  const heading = out.querySelector("h3");
  assert.ok(heading, "empty card should have a heading");
  assert.equal(heading.textContent, EMPTY_HEAD);
  assert.match(out.textContent, new RegExp(EMPTY_TEXT.replace(/\./g, "\\.")));
  assert.equal(out.textContent.includes(OLD_PHRASE), false, "old filter advice must not show");
  assert.equal(cardCount(document), 0);
  assert.ok(document.getElementById("showAll"), "should offer a Show all programs button");
  assert.equal(document.getElementById("showAll").textContent, "Show all programs");
  assert.deepEqual(errors, []);
});

test("r2-teen-flow-5: Show all programs turns My list off, syncs the chip, and shows the cards", async () => {
  const { document, errors } = await loadFind({});
  document.getElementById("savedOnly").click();
  await tick();
  document.getElementById("showAll").click();
  await tick();
  assert.equal(pressed(document.getElementById("savedOnly")), false);
  assert.ok(cardCount(document) > 0, "article.prog cards should appear");
  assert.equal(document.getElementById("out").textContent.includes(OLD_PHRASE), false);
  assert.equal(document.activeElement, document.querySelector("article.prog"), "focus moves to the first card");
  assert.deepEqual(errors, []);
});

test("r2-teen-flow-5: with one saved program, My list shows exactly that card", async () => {
  const id = LITE[0].id;
  const { document, errors } = await loadFind({ saved: [id] });
  document.getElementById("savedOnly").click();
  await tick();
  assert.equal(cardCount(document), 1);
  assert.equal(document.querySelector("article.prog").id, "p-" + id);
  assert.equal(document.getElementById("out").textContent.includes(EMPTY_HEAD), false);
  assert.deepEqual(errors, []);
});

test("r2-teen-flow-5: saved programs hidden by other filters keep the Nothing matches yet card", async () => {
  const id = LITE[0].id;
  const { window, document, errors } = await loadFind({ saved: [id] });
  document.getElementById("savedOnly").click();
  await tick();
  type(window, document.getElementById("q"), "zxqvjwk");
  await tick(220);
  const out = document.getElementById("out");
  assert.match(out.textContent, /Nothing matches yet/);
  assert.equal(out.textContent.includes(EMPTY_HEAD), false);
  assert.ok(document.getElementById("emptyReset"), "keeps the Clear all filters button");
  assert.deepEqual(errors, []);
});
