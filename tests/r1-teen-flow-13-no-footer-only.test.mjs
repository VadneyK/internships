// No teen page may be reachable only from the site footer.
// For each listed built page, the header and footer are removed, and at least one OTHER built page must link to it from inside <main>.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = ["find", "playbook", "resume", "ready", "jobs", "calendar", "paycheck", "safety", "younger", "interview", "permit", "parents"].map((n) => n + ".html");
const SKIPPED = new Set(["leaders.html"]);

// Every built page in the repo root (the generated html files), leaders.html included as a source.
const BUILT = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !f.startsWith("."));

function parse(file) {
  return new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;
}

// True when a link inside main points at target (relative, "./", "#anchor" or "?query" forms all count).
function linksToFromMain(doc, target) {
  const main = doc.querySelector("main");
  if (!main) return false;
  for (const a of main.querySelectorAll("a[href]")) {
    let pathname;
    try {
      pathname = new URL(a.getAttribute("href"), "https://example.invalid/site/").pathname;
    } catch (e) {
      continue;
    }
    if (path.posix.basename(pathname) === target) return true;
  }
  return false;
}

// Removes header and footer elements that sit outside main, so links there do not count.
function stripSiteChrome(doc) {
  const main = doc.querySelector("main");
  for (const el of doc.querySelectorAll("header, footer")) {
    if (!main || !main.contains(el)) el.remove();
  }
  return doc;
}

test("helper: a footer-only link does not count, a main link does", () => {
  const footerOnly = stripSiteChrome(new JSDOM('<body><header><a href="x.html">h</a></header><main><p>hi</p></main><footer><a href="jobs.html">f</a></footer></body>').window.document);
  assert.equal(linksToFromMain(footerOnly, "jobs.html"), false);
  const inMain = stripSiteChrome(new JSDOM('<body><header></header><main><a href="./jobs.html#top">j</a></main><footer></footer></body>').window.document);
  assert.equal(linksToFromMain(inMain, "jobs.html"), true);
});

test("every teen page is linked from main content of another page", () => {
  for (const t of TARGETS) assert.ok(fs.existsSync(path.join(ROOT, t)), "built page missing: " + t);
  const failing = [];
  const stripped = new Map(BUILT.map((f) => [f, stripSiteChrome(parse(f))]));
  for (const target of TARGETS) {
    if (SKIPPED.has(target)) continue;
    const linked = BUILT.some((src) => src !== target && linksToFromMain(stripped.get(src), target));
    if (!linked) failing.push(target);
  }
  assert.deepEqual(failing, [], "reachable only from the footer (no other page links to them from main content): " + failing.join(", "));
});
