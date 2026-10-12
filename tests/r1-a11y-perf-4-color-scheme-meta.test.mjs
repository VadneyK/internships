// Color scheme meta: every root page (404.html included) has exactly one meta name="color-scheme" content="light dark" in head,
// placed before the first link rel="stylesheet", so native controls and the first paint match the theme.
// Run with: node --test tests/r1-a11y-perf-4-color-scheme-meta.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

test("root pages include 404.html and there is at least one page to check", () => {
  assert.ok(PAGES.includes("404.html"), "404.html is a root page");
  assert.ok(PAGES.length > 1, "found root pages");
});

for (const page of PAGES) {
  test(`${page}: one color-scheme meta in head, light dark, before the first stylesheet link`, () => {
    const html = fs.readFileSync(path.join(ROOT, page), "utf8");
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    try {
      const metas = [...doc.querySelectorAll('meta[name="color-scheme"]')];
      assert.equal(metas.length, 1, `${page} has ${metas.length} color-scheme metas`);
      const meta = metas[0];
      assert.equal(meta.parentElement && meta.parentElement.tagName, "HEAD", `${page} color-scheme meta is not in head`);
      assert.equal(meta.getAttribute("content"), "light dark", `${page} color-scheme content is "${meta.getAttribute("content")}"`);

      const firstSheet = doc.querySelector('head link[rel="stylesheet"]');
      assert.ok(firstSheet, `${page} has no stylesheet link in head`);
      const before = meta.compareDocumentPosition(firstSheet) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING;
      assert.ok(before, `${page} color-scheme meta comes after the first stylesheet link`);
    } finally {
      dom.window.close();
    }
  });
}
