// r3-teen-flow-1: on younger.html the "Work near home" block (#earn) comes before the state grid (#grid, part 1).
// So any text inside #earn that says "grid above" or "table above" points the wrong way for a 12 year old scrolling up.
// Checks the built page with its real scripts, and the strings in data/younger.json that fill #earn.
// The ladder step (ladder[1].d) comes after the grid, so its "Use the grid above" is correct and is pinned by r3-accuracy-2.
// Run with: node --test tests/r3-teen-flow-1-younger-grid-direction.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRONG = /\b(?:grid|table)\s+above\b/i;

test("r3-teen-flow-1: data/younger.json near strings never say grid above or table above", () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "younger.json"), "utf8"));
  const strings = [data.near.note, ...data.near.items.map((x) => x.t)];
  const bad = strings.filter((s) => WRONG.test(s));
  assert.deepEqual(bad, [], "near text that points up at the grid:\n" + bad.join("\n"));
  const pointing = strings.filter((s) => /\bgrid below\b/i.test(s));
  assert.ok(pointing.length >= 3, "the note and the three grid items point down at the grid");
});

test("r3-teen-flow-1: no text inside #earn says grid above or table above while #grid comes later", async () => {
  const { document, window } = await loadPage("younger.html");
  await tick(200);
  const earn = document.getElementById("earn");
  const grid = document.getElementById("grid");
  assert.ok(earn && grid, "#earn and #grid are on the page");
  assert.ok(earn.compareDocumentPosition(grid) & window.Node.DOCUMENT_POSITION_FOLLOWING, "#grid comes after #earn");
  const walker = document.createTreeWalker(earn, window.NodeFilter.SHOW_TEXT);
  const hits = [];
  let node;
  while ((node = walker.nextNode())) {
    if (WRONG.test(node.nodeValue)) hits.push(node.nodeValue.replace(/\s+/g, " ").trim());
  }
  assert.deepEqual(hits, [], "#earn text that points up at #grid:\n" + hits.join("\n"));
  assert.match(document.getElementById("nearNote").textContent, /grid below/);
});
