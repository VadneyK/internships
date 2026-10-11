// Ticket r8-teen-flow-3: younger.html says what to do when a teen's state is not one of the four.
// Run with: node --test tests/r8-teen-flow-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED = "Not in these four states? The federal rule above still applies, and your state can be stricter. Use the work permit finder to see your state, or ask your state labor office.";

test("younger: the not-listed line sits in #grid right after #yState, with the exact plain words", async () => {
  const { document, errors } = await loadPage("younger.html");
  await tick(120);
  assert.deepEqual(errors, []);
  const grid = document.getElementById("grid");
  const sel = document.getElementById("yState");
  const line = document.getElementById("yOther");
  assert.ok(line, "the line exists");
  assert.equal(line.tagName, "P");
  assert.ok(grid.contains(line), "the line is inside #grid");
  assert.ok(grid.contains(sel), "the select is inside #grid");
  assert.ok(sel.compareDocumentPosition(line) & 4, "the line comes after #yState in the document");
  assert.equal(line.textContent.replace(/\s+/g, " ").trim(), EXPECTED);
  assert.ok(line.className.includes("muted"), "the line is muted");
});

test("younger: exactly one link in #grid, and it goes to permit.html", async () => {
  const { document } = await loadPage("younger.html");
  const links = [...document.getElementById("grid").querySelectorAll("a")].filter((a) => a.getAttribute("href") === "permit.html");
  assert.equal(links.length, 1, "one permit.html link in the grid");
  assert.equal(links[0].textContent.trim(), "work permit finder");
  assert.equal(links[0].closest("#yOther") !== null, true, "the link is in the not-listed line");
});

test("younger: the federal rule the line points to is still printed in #fedNote", async () => {
  const { document } = await loadPage("younger.html");
  await tick(120);
  assert.ok(document.getElementById("fedNote").textContent.trim().length > 0, "fedNote has the federal rule");
});

test("younger: the page source has no en dash and no em dash", () => {
  const src = readFileSync(join(repo, "younger.html"), "utf8");
  assert.doesNotMatch(src, /[\u2013\u2014]/);
  const srcTemplate = readFileSync(join(repo, "src/younger.html"), "utf8");
  assert.doesNotMatch(srcTemplate, /[\u2013\u2014]/);
});
