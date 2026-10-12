// Ticket r2-teen-flow-1: the "last read" date leaves the lede on Ready, Ages 12 to 14, Apply and
// interview, and First paycheck. Each date moves to a p.small.muted line directly after the lede.
// Reads the built root pages. Run with: node --test tests/r2-teen-flow-30-lede-last-read.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CASES = [
  { file: "ready.html", sentence: "Last read from official pages on Oct 9, 2026." },
  { file: "younger.html", sentence: "Last read Oct 9, 2026." },
  { file: "interview.html", sentence: "Last read Oct 9, 2026." },
  { file: "paycheck.html", sentence: "Last read Oct 10, 2026." },
];

function loadDoc(file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  return new JSDOM(html).window.document;
}

for (const { file, sentence } of CASES) {
  test(`${file}: the lede has no last-read date`, () => {
    const lede = loadDoc(file).querySelector("p.lede");
    assert.ok(lede, `${file} has p.lede`);
    assert.doesNotMatch(lede.textContent, /last read/i, "lede has no 'last read' text");
    assert.doesNotMatch(lede.textContent, /Oct 9, 2026|Oct 10, 2026/, "lede has no read date");
  });

  test(`${file}: a p.small.muted right after the lede holds the date sentence`, () => {
    const lede = loadDoc(file).querySelector("p.lede");
    const line = lede.nextElementSibling;
    assert.ok(line && line.tagName === "P", "a p directly follows the lede");
    assert.ok(line.classList.contains("small") && line.classList.contains("muted"), "p has small and muted classes");
    assert.equal(line.textContent.trim(), sentence);
  });
}
