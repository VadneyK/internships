// r5-a11y-1: the star shows saved or not saved with a shape and a word, and results focus lands on the visible count line.
// Run with: node --test tests/r5-teen-flow-9-saved-star.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const JS = fs.readFileSync(path.join(ROOT, "assets/js/find.js"), "utf8");

test("not saved: an outline star and no word", async () => {
  const { document } = await loadPage("find.html");
  const star = document.querySelector("article.prog .star");
  assert.equal(star.getAttribute("aria-pressed"), "false");
  assert.equal(star.textContent.trim(), "☆");
  assert.equal(star.querySelector(".star-w"), null);
});

test("saved: a filled star and the word Saved; name and aria-pressed kept", async () => {
  const { document } = await loadPage("find.html");
  const star = document.querySelector("article.prog .star");
  const label = star.getAttribute("aria-label");
  star.focus();
  star.click();
  assert.equal(star.getAttribute("aria-pressed"), "true");
  assert.equal(star.textContent.replace(/\s+/g, " ").trim(), "★Saved");
  assert.equal(star.getAttribute("aria-label"), label);
  assert.equal(document.activeElement, star);
  star.click();
  assert.equal(star.getAttribute("aria-pressed"), "false");
  assert.equal(star.textContent.trim(), "☆");
});

test("a saved card drawn again after Show more still has the word", async () => {
  const { document } = await loadPage("find.html");
  const star = document.querySelector("article.prog .star");
  star.click();
  const id = star.getAttribute("data-id");
  document.getElementById("savedOnly").click();
  await tick();
  const again = document.querySelector('.star[data-id="' + id + '"]');
  assert.match(again.textContent, /Saved/);
});

test("#count is focusable by script and has a visible focus ring from the focus token", async () => {
  const { document } = await loadPage("find.html");
  const count = document.getElementById("count");
  assert.equal(count.getAttribute("tabindex"), "-1");
  // Reconciled 2026-10-11 with r3-a11y-perf-27: #count is no longer a live region (it would read a changing count over typing).
  // Focus still lands here, so a screen reader reads the count on focus. The spoken copy is the status region #countLive.
  assert.equal(count.getAttribute("aria-live"), null);
  assert.equal(document.getElementById("countLive").getAttribute("role"), "status");
  assert.match(CSS, /#count:focus\s*\{[^}]*outline:\s*3px solid var\(--focus\)/);
});

test("find.js sends results focus to #count, not the hidden heading", () => {
  assert.equal(/\$\("results"\)/.test(JS), false);
  assert.match(JS, /\$\("count"\); if \(r\) r\.focus\(\)/);
});
