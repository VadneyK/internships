// Run with: node --test tests/r3-tests-1-meta-descriptions.test.mjs
// Search results cut a description off near 160 characters, so every built root page needs its own short
// meta description. Each page has exactly one <meta name="description">, no text is shared with another page,
// og:description and twitter:description (when present) equal it, and it has no dash character, no raw "&amp;",
// and no URL. Pages over 200 characters are listed in KNOWN_LONG with their current length. A listed page may
// not grow, and a listed page that drops to 200 or under must be removed from the list, so the list only shrinks.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CEILING = 200;

// Pages whose description is over CEILING, with the length measured today. Shorten the text, then lower
// or remove the entry here. Do not raise a number.
const KNOWN_LONG = {
  "index.html": 220,
  "interview.html": 232,
  "jobs.html": 279,
  "languages.html": 254,
  "leaders.html": 210,
  "parents.html": 290,
  "paycheck.html": 261,
  "ready.html": 212,
  "safety.html": 274,
  "states.html": 236,
  "younger.html": 251,
};

const PAGES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort();

const DASH = /[\u2013\u2014]/;
const URL_RE = /https?:\/\/|www\.|\.github\.io|\.html\b/i;

function readPage(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const doc = new JSDOM(raw).window.document;
  const descs = [...doc.querySelectorAll('meta[name="description"]')];
  const og = [...doc.querySelectorAll('meta[property="og:description"]')];
  const tw = [...doc.querySelectorAll('meta[name="twitter:description"]')];
  return { raw, descs, og, tw };
}

const pages = PAGES.map((file) => ({ file, ...readPage(file) }));

test("every root page has exactly one meta description with text", () => {
  for (const p of pages) {
    assert.equal(p.descs.length, 1, `${p.file}: expected 1 meta description, found ${p.descs.length}`);
    const text = p.descs[0].getAttribute("content") || "";
    assert.ok(text.trim().length > 0, `${p.file}: meta description is empty`);
  }
});

test("meta descriptions are unique across pages", () => {
  const owner = new Map();
  for (const p of pages) {
    const text = p.descs[0].getAttribute("content");
    if (owner.has(text)) {
      assert.fail(`${p.file} repeats the description of ${owner.get(text)}`);
    }
    owner.set(text, p.file);
  }
});

test("og:description and twitter:description match the meta description when present", () => {
  for (const p of pages) {
    const text = p.descs[0].getAttribute("content");
    for (const el of [...p.og, ...p.tw]) {
      const name = el.getAttribute("property") || el.getAttribute("name");
      assert.equal(el.getAttribute("content"), text, `${p.file}: ${name} does not match meta description`);
    }
  }
});

test("descriptions have no dash, no raw &amp;, and no URL", () => {
  for (const p of pages) {
    const text = p.descs[0].getAttribute("content");
    assert.ok(!DASH.test(text), `${p.file}: description has an en or em dash`);
    const tag = p.raw.match(/<meta\s+name="description"[^>]*>/)?.[0] || "";
    assert.ok(!tag.includes("&amp;"), `${p.file}: description has a raw &amp; entity in its source`);
    assert.ok(!URL_RE.test(text), `${p.file}: description contains a URL or file name: ${text}`);
  }
});

test("descriptions over 200 characters are listed in KNOWN_LONG and do not grow", () => {
  for (const p of pages) {
    const len = p.descs[0].getAttribute("content").length;
    const listed = KNOWN_LONG[p.file];
    if (len > CEILING) {
      assert.ok(listed !== undefined, `${p.file}: description is ${len} characters, over ${CEILING}, and not in KNOWN_LONG`);
      assert.ok(len <= listed, `${p.file}: description is ${len} characters, over its listed ${listed}`);
    }
  }
});

test("KNOWN_LONG only lists pages still over the ceiling, with their current length", () => {
  for (const [file, listed] of Object.entries(KNOWN_LONG)) {
    const p = pages.find((x) => x.file === file);
    assert.ok(p, `${file} is in KNOWN_LONG but is not a root page`);
    const len = p.descs[0].getAttribute("content").length;
    assert.ok(len > CEILING, `${file}: description is now ${len} characters, at or under ${CEILING}; remove it from KNOWN_LONG`);
    assert.equal(len, listed, `${file}: description is ${len} characters, KNOWN_LONG says ${listed}; update the entry`);
  }
});
