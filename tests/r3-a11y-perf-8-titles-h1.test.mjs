// Ticket r3-a11y-perf-8: every built root page has a unique title, exactly one h1 with text,
// a title that names its h1, an og:title equal to the title, and no em or en dash in the title.
// Pages are parsed with JSDOM (no scripts run). Nothing is loaded from the network.
// Run with: node --test tests/r3-a11y-perf-8-titles-h1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Pages left out of the checks, each with its reason.
// 404.html: the error page for a missing URL. Its title and h1 are written for that case, not for a teen guide page.
// No share fixtures are kept at the repo root, so only the error page is excluded.
const EXCLUDED = {
  "404.html": "error page for a missing URL",
};

// Pages allowed to have a title that shares no word with the h1. Empty on purpose: every page should name its h1.
// Add a file here only with a reason written next to it.
const TITLE_H1_ALLOW = {};


// Words that do not count as a match between a title and an h1.
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "do", "for", "from", "how", "i", "if", "in",
  "is", "it", "of", "on", "or", "out", "so", "the", "this", "to", "up", "we", "what", "when", "with", "you",
]);

// Dashes written as escapes so this file never contains the characters itself.
const DASH_RE = /[\u2013\u2014]/;

// Pages to check: every root .html file except the excluded ones, in sorted order.
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !EXCLUDED[f]).sort();

// Light stemming so "Programs" and "program" match. Strips a plural "s" from words longer than three letters.
function stem(word) {
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function contentWords(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((w) => !STOPWORDS.has(w))
    .map(stem);
}

// Text of the h1 with a space between child elements, so "How to find<span>Internships</span>" reads as two words.
function h1Text(doc, h1) {
  const spaced = h1.innerHTML.replace(/<br\s*\/?>|<\/?[a-z][^>]*>/gi, " ");
  const probe = doc.createElement("div");
  probe.innerHTML = spaced;
  return probe.textContent.replace(/\s+/g, " ").trim();
}

const parsed = new Map();
for (const file of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const dom = new JSDOM(html);
  parsed.set(file, dom.window.document);
}

function titleOf(doc) {
  const el = doc.querySelector("title");
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

test("every page has a non-empty title", () => {
  const failing = [];
  for (const file of PAGES) {
    const title = titleOf(parsed.get(file));
    if (!title) failing.push(`${file}: empty title`);
  }
  assert.deepEqual(failing, [], "pages with a missing title:\n" + failing.join("\n"));
});

test("titles are unique across pages", () => {
  const seen = new Map();
  for (const file of PAGES) {
    const title = titleOf(parsed.get(file));
    if (!seen.has(title)) seen.set(title, []);
    seen.get(title).push(file);
  }
  const dupes = [...seen.entries()].filter(([, files]) => files.length > 1)
    .map(([title, files]) => `"${title}": ${files.join(", ")}`);
  assert.deepEqual(dupes, [], "pages that share a title:\n" + dupes.join("\n"));
});

test("each page has exactly one h1 with non-empty text", () => {
  const failing = [];
  for (const file of PAGES) {
    const h1s = parsed.get(file).querySelectorAll("h1");
    if (h1s.length !== 1) {
      failing.push(`${file}: ${h1s.length} h1 elements`);
      continue;
    }
    if (!h1Text(parsed.get(file), h1s[0])) failing.push(`${file}: h1 has no text`);
  }
  assert.deepEqual(failing, [], "pages without exactly one non-empty h1:\n" + failing.join("\n"));
});

test("each title shares at least one non-stopword word with its h1", () => {
  const failing = [];
  for (const file of PAGES) {
    if (TITLE_H1_ALLOW[file]) continue;
    const doc = parsed.get(file);
    const h1 = doc.querySelector("h1");
    if (!h1) continue; // reported by the one-h1 test
    const titleWords = new Set(contentWords(titleOf(doc)));
    const shared = contentWords(h1Text(doc, h1)).some((w) => titleWords.has(w));
    if (!shared) failing.push(`${file}: title "${titleOf(doc)}" does not name h1 "${h1Text(doc, h1)}"`);
  }
  assert.deepEqual(failing, [], "titles that do not name their h1:\n" + failing.join("\n"));
});

test("og:title equals the title on every page", () => {
  const failing = [];
  for (const file of PAGES) {
    const doc = parsed.get(file);
    const meta = doc.querySelector('meta[property="og:title"]');
    if (!meta) {
      failing.push(`${file}: no og:title meta`);
      continue;
    }
    const og = (meta.getAttribute("content") || "").replace(/\s+/g, " ").trim();
    if (og !== titleOf(doc)) failing.push(`${file}: og:title "${og}" differs from title "${titleOf(doc)}"`);
  }
  assert.deepEqual(failing, [], "pages where og:title differs from the title:\n" + failing.join("\n"));
});

test("no title contains an em dash or an en dash", () => {
  const failing = [];
  for (const file of PAGES) {
    const title = titleOf(parsed.get(file));
    if (DASH_RE.test(title)) failing.push(`${file}: ${title}`);
  }
  assert.deepEqual(failing, [], "titles with a dash character:\n" + failing.join("\n"));
});
