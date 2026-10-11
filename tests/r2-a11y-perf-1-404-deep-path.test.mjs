// The 404 page is served by GitHub Pages for a bad path at any depth.
// Every href and src must land on the same file under /internships/ when the page is opened at a deep address.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://vadneyk.github.io/internships/";
const DEEP = SITE + "a/b/c";
const SKIP = /^(https?:|mailto:|tel:|sms:|#)/i;

function deepProblems(html, pageUrl) {
  const doc = new JSDOM(html, { url: pageUrl }).window.document;
  const out = [];
  for (const el of doc.querySelectorAll("[href],[src]")) {
    for (const attr of ["href", "src"]) {
      const v = el.getAttribute(attr);
      if (v === null || v === "" || SKIP.test(v)) continue;
      const deep = new URL(v, DEEP).href;
      const home = new URL(v, SITE).href;
      if (deep !== home) out.push(`${el.tagName.toLowerCase()} ${attr}="${v}" resolves to ${deep}, not ${home}`);
      if (!deep.startsWith(SITE)) out.push(`${attr}="${v}" leaves ${SITE}`);
    }
  }
  return out;
}

test("404.html: every link resolves the same at a deep address as at the site root", () => {
  const html = fs.readFileSync(path.join(ROOT, "404.html"), "utf8");
  assert.deepEqual(deepProblems(html, DEEP), []);
  assert.ok(/<link rel="stylesheet" href="\/internships\/assets\/css\/style\.css/.test(html), "style sheet is root-anchored");
  assert.ok(/<script src="\/internships\/assets\/js\/common\.js/.test(html), "script is root-anchored");
});

test("other built pages stay relative", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(html.includes('href="assets/css/style.css'));
});

test("seeded bad page fires the rule", () => {
  const bad = '<html><head><link rel="stylesheet" href="assets/css/style.css"></head><body><a href="find.html">x</a><a href="#top">y</a><a href="mailto:a@b.c">m</a></body></html>';
  const p = deepProblems(bad, DEEP);
  assert.equal(p.length, 2);
});
