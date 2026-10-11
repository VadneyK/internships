// 404 page: the buttons a teen needs most for a first job.
// Pure test: reads the built 404.html, checks each link target exists, no duplicates, and no long dash.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED = ["jobs.html", "younger.html", "paycheck.html", "calendar.html", "interview.html"];

const html = fs.readFileSync(path.join(ROOT, "404.html"), "utf8");
const srcHtml = fs.readFileSync(path.join(ROOT, "src", "404.html"), "utf8");
const doc = new JSDOM(html).window.document;
const main = doc.querySelector("main");
// The built 404.html root-anchors its links under /internships/ so they work at any depth.
const bare = (h) => h.replace(/^\/internships\//, "");

test("404.html: each required page has a plain button in the main content", () => {
  const hrefs = [...main.querySelectorAll("a[href]")].map((a) => bare(a.getAttribute("href")));
  for (const page of REQUIRED) {
    assert.ok(hrefs.includes(page), `missing button to ${page}`);
    const a = main.querySelector(`a[href="/internships/${page}"]`);
    assert.ok((a.textContent || "").trim().length > 0, `button to ${page} has no text`);
    assert.equal(a.children.length, 0, `button to ${page} has extra markup inside it`);
  }
});

test("404.html: every link in the main content points to a page that exists", () => {
  const missing = [];
  for (const a of main.querySelectorAll("a[href]")) {
    const href = bare(a.getAttribute("href"));
    if (/^(https?:|mailto:|#)/i.test(href)) continue;
    const file = href.split(/[?#]/)[0];
    if (!fs.existsSync(path.join(ROOT, file))) missing.push(href);
  }
  assert.deepEqual(missing, []);
});

test("404.html: no link is duplicated in the main content", () => {
  const hrefs = [...main.querySelectorAll("a[href]")].map((a) => bare(a.getAttribute("href")));
  const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
  assert.deepEqual([...new Set(dupes)], []);
});

test("404.html and src/404.html: no em dash or en dash, as a character or an entity", () => {
  const longDash = /[‒-―]|&(?:mdash|ndash|#8211|#8212|#x2013|#x2014);/i;
  assert.equal(longDash.test(html), false, "built 404.html has a long dash");
  assert.equal(longDash.test(srcHtml), false, "src/404.html has a long dash");
});
