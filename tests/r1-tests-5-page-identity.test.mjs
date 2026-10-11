// Run with: node --test tests/r1-tests-5-page-identity.test.mjs
// Page identity for every built root page (all but 404):
// - <title> is non-empty, under 70 characters, unique across pages, and has no em or en dash.
// - exactly one <h1>, and it is non-empty.
// - <link rel="canonical"> and <meta property="og:url"> are the same absolute https URL, and it ends in
//   that page's file name (index.html maps to the site root).
// - og:title and twitter:title, when present, equal the title or start with it.
// - the page's own URL is listed in sitemap.xml.
// Each failing check names the page and the field in its assertion message.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://vadneyk.github.io/internships/";
const EM_OR_EN = /[\u2013\u2014]/;

const PAGES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html") && f !== "404.html")
  .sort();

const SITEMAP = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const SITEMAP_URLS = new Set([...SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));

function expectedUrl(file) {
  return file === "index.html" ? BASE : BASE + file;
}

function load(file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const title = (doc.querySelector("title")?.textContent ?? "").trim();
  const h1s = [...doc.querySelectorAll("h1")];
  const h1 = (h1s[0]?.textContent ?? "").trim();
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ?? null;
  const ogUrl = doc.querySelector('meta[property="og:url"]')?.getAttribute("content")?.trim() ?? null;
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ?? null;
  const twTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute("content")?.trim() ?? null;
  const noindex = doc.querySelector('meta[name="robots"]')?.getAttribute("content")?.includes("noindex") ?? false;
  return { file, title, h1Count: h1s.length, h1, canonical, ogUrl, ogTitle, twTitle, noindex };
}

const PAGE_DATA = PAGES.map(load);

test("every built root page was found", () => {
  assert.ok(PAGES.length >= 20, `expected at least 20 root pages, found ${PAGES.length}`);
});

test("title is non-empty, under 70 characters and has no em or en dash", () => {
  const bad = [];
  for (const p of PAGE_DATA) {
    if (!p.title) bad.push(`${p.file}: title is empty`);
    else if (p.title.length >= 70) bad.push(`${p.file}: title is ${p.title.length} characters (limit is under 70)`);
    if (EM_OR_EN.test(p.title)) bad.push(`${p.file}: title has an em or en dash`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("title is unique across pages", () => {
  const seen = new Map();
  const dupes = [];
  for (const p of PAGE_DATA) {
    if (!p.title) continue;
    if (seen.has(p.title)) dupes.push(`${p.file}: title duplicates ${seen.get(p.title)} ("${p.title}")`);
    else seen.set(p.title, p.file);
  }
  assert.deepEqual(dupes, [], dupes.join("\n"));
});

test("exactly one h1 and it is non-empty", () => {
  const bad = [];
  for (const p of PAGE_DATA) {
    if (p.h1Count !== 1) bad.push(`${p.file}: h1 count is ${p.h1Count} (need exactly 1)`);
    else if (!p.h1) bad.push(`${p.file}: h1 is empty`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("canonical is an absolute https URL that ends in the page file name", () => {
  const bad = [];
  for (const p of PAGE_DATA) {
    const want = expectedUrl(p.file);
    if (p.canonical === null) bad.push(`${p.file}: canonical link is missing`);
    else if (p.canonical !== want) bad.push(`${p.file}: canonical is "${p.canonical}" (expected "${want}")`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("og:url equals the canonical URL", () => {
  const bad = [];
  for (const p of PAGE_DATA) {
    const want = expectedUrl(p.file);
    if (p.ogUrl === null) bad.push(`${p.file}: og:url is missing`);
    else if (p.ogUrl !== want) bad.push(`${p.file}: og:url is "${p.ogUrl}" (expected "${want}")`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("og:title and twitter:title, when present, equal or start with the title", () => {
  const bad = [];
  for (const p of PAGE_DATA) {
    if (p.ogTitle !== null && !(p.ogTitle === p.title || p.ogTitle.startsWith(p.title))) {
      bad.push(`${p.file}: og:title "${p.ogTitle}" does not match title "${p.title}"`);
    }
    if (p.twTitle !== null && !(p.twTitle === p.title || p.twTitle.startsWith(p.title))) {
      bad.push(`${p.file}: twitter:title "${p.twTitle}" does not match title "${p.title}"`);
    }
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("each indexable page's own URL is listed in sitemap.xml", () => {
  // tools/build.py leaves out pages marked noindex on purpose (leaders.html is unlisted until the owner approves it).
  const indexable = PAGE_DATA.filter((p) => !p.noindex);
  const missing = indexable.filter((p) => !SITEMAP_URLS.has(expectedUrl(p.file))).map(
    (p) => `${p.file}: sitemap.xml has no <loc> for ${expectedUrl(p.file)}`,
  );
  assert.deepEqual(missing, [], missing.join("\n"));
});
