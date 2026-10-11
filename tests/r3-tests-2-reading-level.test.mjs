// Reading level and sentence length on every built root page.
// Main text only: script, style, noscript, nav, footer, table, .printonly, URLs and emails are removed.
// A page may be over the limits only if it is listed in KNOWN_OVER. A new offender fails, and a fixed
// page must be removed from the table (the test fails when a listed page is now fine).
// Run with: node --test tests/r3-tests-2-reading-level.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_GRADE = 9.0;
const MAX_SENTENCE_WORDS = 40;

// Current offenders. grade: the page grade is over MAX_GRADE. longest: a sentence is over MAX_SENTENCE_WORDS.
// Each entry is the most the page may score today; fix the page, then remove the entry or lower it.
const KNOWN_OVER = {
  "about.html": { longest: 62 },
  "find.html": { longest: 41 },
  "leaders.html": { longest: 41 },
  "ready.html": { longest: 41 },
  "rules.html": { longest: 43 },
  "states.html": { longest: 41 },
};

function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

// Returns { words, sentences, syllables, grade, longest, longestWords } for plain text.
// Lines (block breaks) and . ! ? end a sentence.
export function score(text) {
  const sentences = text.split(/[.!?]+(?:\s|$)|\n+/).map((s) => s.trim()).filter((s) => /[a-z]/i.test(s));
  let words = 0, syl = 0, longest = "", longestWords = 0;
  for (const s of sentences) {
    const ws = s.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
    words += ws.length;
    for (const w of ws) syl += syllables(w);
    if (ws.length > longestWords) { longestWords = ws.length; longest = s; }
  }
  const grade = words && sentences.length ? 0.39 * (words / sentences.length) + 11.8 * (syl / words) - 15.59 : 0;
  return { words, sentences: sentences.length, syllables: syl, grade, longest, longestWords };
}

function mainText(file) {
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8"));
  const doc = dom.window.document;
  const root = doc.querySelector("main") || doc.body;
  root.querySelectorAll("script, style, noscript, nav, footer, table, .printonly").forEach((n) => n.remove());
  root.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, div, section, dt, dd, summary, label, button, br").forEach((n) => n.append("\n"));
  const text = root.textContent
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, " ")
    .replace(/[ \t]+/g, " ");
  dom.window.close();
  return text;
}

const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

test("scorer: easy text is low grade, hard text is high grade", () => {
  const easy = score("The cat sat on the mat. The dog ran to the log. I like to go to the park. We can play all day.");
  const hard = score("Notwithstanding considerable administrative complexity, organizations frequently necessitate comprehensive documentation regarding employment eligibility verification requirements, particularly concerning international applicants.");
  assert.ok(easy.grade < 3, "easy grade " + easy.grade);
  assert.ok(hard.grade > 15, "hard grade " + hard.grade);
  assert.equal(easy.sentences, 4);
  assert.equal(hard.longestWords, hard.words);
  assert.equal(syllables("make"), 1);
  assert.equal(syllables("table"), 2);
  assert.equal(syllables("internship"), 3);
});

test("there are built pages to check", () => assert.ok(PAGES.length >= 15, PAGES.join(",")));

for (const file of PAGES) {
  test(`reading level: ${file}`, () => {
    const s = score(mainText(file));
    const known = KNOWN_OVER[file] || {};
    const gradeOver = s.grade > MAX_GRADE;
    const longOver = s.longestWords > MAX_SENTENCE_WORDS;
    const info = `${file}: grade ${s.grade.toFixed(1)} (max ${MAX_GRADE}), longest sentence ${s.longestWords} words (max ${MAX_SENTENCE_WORDS}). Longest sentence: "${s.longest}"`;
    if (gradeOver) assert.ok(known.grade !== undefined && s.grade <= known.grade, "Grade too high. " + info);
    else assert.equal(known.grade, undefined, `${file} now meets the grade limit (${s.grade.toFixed(1)}). Remove its grade entry from KNOWN_OVER.`);
    if (longOver) assert.ok(known.longest !== undefined && s.longestWords <= known.longest, "Sentence too long. " + info);
    else assert.equal(known.longest, undefined, `${file} now meets the sentence cap (${s.longestWords} words). Remove its longest entry from KNOWN_OVER.`);
  });
}
