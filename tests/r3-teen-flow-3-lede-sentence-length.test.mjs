// Ticket r3-teen-flow-3: the lede on the main teen pages reads in short sentences.
// Every p.lede on these built root pages has at most 24 words in each sentence and at most 45 words in total.
// The interview lede names five parts, the same five as its nav chips. Run with:
// node --test tests/r3-teen-flow-3-lede-sentence-length.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = [
  "find", "permit", "interview", "paycheck", "younger", "calendar",
  "ready", "playbook", "resume", "jobs", "safety",
];

function loadDoc(file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  return new JSDOM(html).window.document;
}

function words(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Split on a period, question mark or exclamation mark followed by a space or the end of the text.
function sentences(text) {
  return text
    .trim()
    .split(/[.!?]+(?=\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

for (const page of PAGES) {
  const file = `${page}.html`;
  test(`${file}: every lede sentence is 24 words or fewer and the lede is 45 words or fewer`, () => {
    const ledes = loadDoc(file).querySelectorAll("p.lede");
    assert.ok(ledes.length >= 1, `${file} has a p.lede`);
    for (const lede of ledes) {
      const text = lede.textContent;
      const total = words(text).length;
      assert.ok(total <= 45, `${file} lede is ${total} words, want at most 45`);
      for (const sentence of sentences(text)) {
        const n = words(sentence).length;
        assert.ok(n <= 24, `${file} lede sentence is ${n} words, want at most 24: "${sentence}"`);
      }
    }
  });
}

test("interview lede names five parts, the same count as its nav chips", () => {
  const doc = loadDoc("interview.html");
  const lede = doc.querySelector("p.lede").textContent;
  const chips = doc.querySelectorAll("#parts a.chip");
  assert.equal(chips.length, 5, "interview has five nav chips");
  assert.match(lede, /^Five parts make a first application strong\./, "lede says five parts");
  assert.doesNotMatch(lede, /\bFour\b/, "lede does not say four");
});

test("permit lede still ends with the checklist sentence", () => {
  const lede = loadDoc("permit.html").querySelector("p.lede").textContent.trim();
  assert.match(lede, /a checklist you can print or a message you can send to your school\.$/);
  assert.doesNotMatch(lede, /last read/i, "permit lede has no last-read text");
});
