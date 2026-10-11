// The teacher handout must be linked from the body text of its breadcrumb parent (ready.html)
// and from share.html, which holds the QR codes. A footer-only link does not count.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = "handout.html";
const SOURCES = ["ready.html", "share.html"];

function mainLinksTo(file, target) {
  const doc = new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;
  const main = doc.querySelector("main");
  if (!main) return false;
  // Links inside header or footer do not count, only links in main content.
  for (const a of main.querySelectorAll("a[href]")) {
    if (a.closest("header, footer")) continue;
    const pathname = new URL(a.getAttribute("href"), "https://example.invalid/site/").pathname;
    if (path.posix.basename(pathname) === target) return true;
  }
  return false;
}

test("handout page is built", () => {
  assert.ok(fs.existsSync(path.join(ROOT, TARGET)), "built page missing: " + TARGET);
});

test("ready.html and share.html link to the handout from main content", () => {
  const missing = SOURCES.filter((f) => !mainLinksTo(f, TARGET));
  assert.deepEqual(missing, [], "no body link to handout.html on: " + missing.join(", "));
});
