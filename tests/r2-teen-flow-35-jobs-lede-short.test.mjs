// Ticket r2-teen-flow-6 (jobs lede short): the Jobs lede is at most 40 words, starts with "Tap your age",
// and still links to find.html. The sentence about the second tag sits in a p.small.muted directly
// under the lede. Reads the built jobs.html.
// Run with: node --test tests/r2-teen-flow-35-jobs-lede-short.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDoc() {
  const html = fs.readFileSync(path.join(ROOT, "jobs.html"), "utf8");
  return new JSDOM(html).window.document;
}

test("jobs lede is at most 40 words and starts with 'Tap your age'", () => {
  const lede = loadDoc().querySelector("p.lede");
  assert.ok(lede, "jobs.html has p.lede");
  const words = lede.textContent.trim().split(/\s+/).filter(Boolean);
  assert.ok(words.length <= 40, `lede has ${words.length} words, want at most 40`);
  assert.match(lede.textContent.trim(), /^Tap your age\./);
});

test("jobs lede still links to find.html", () => {
  const lede = loadDoc().querySelector("p.lede");
  const link = lede.querySelector('a[href="find.html"]');
  assert.ok(link, "lede links to find.html");
});

test("the second-tag sentence moved unchanged into a p.small.muted under the lede", () => {
  const doc = loadDoc();
  const lede = doc.querySelector("p.lede");
  const sentence = "A second tag shows when an age is for some jobs only or the posting is old.";
  assert.equal(lede.textContent.includes("second tag"), false, "the lede no longer explains the second tag");
  const next = lede.nextElementSibling;
  assert.ok(next && next.tagName === "P", "a p directly follows the lede");
  assert.ok(next.classList.contains("small") && next.classList.contains("muted"), "p has small and muted classes");
  assert.equal(next.textContent.trim(), sentence);
  assert.match(next.textContent, /some jobs only/);
  assert.match(next.textContent, /posting is old/);
});
