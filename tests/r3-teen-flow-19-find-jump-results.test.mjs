// Ticket r3-teen-flow-19: the Find page has one "Jump to the results" link right after the filter form.
// Run with: node --test tests/r3-teen-flow-19-find-jump-results.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "find.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const { document } = new JSDOM(html).window;

test("find.html has exactly one Jump to the results link", () => {
  const links = document.querySelectorAll('a[href="#results"]');
  assert.equal(links.length, 1);
  assert.equal(links[0].textContent.trim(), "Jump to the results");
  assert.ok(links[0].classList.contains("noprint"));
  assert.ok(links[0].classList.contains("small"));
});

test("the link target exists, is the Results heading, and is focusable by script", () => {
  const target = document.getElementById("results");
  assert.ok(target, "#results exists");
  assert.equal(document.querySelectorAll("#results").length, 1);
  assert.equal(target.tagName, "H2");
  assert.equal(target.textContent.trim(), "Results");
  assert.equal(target.getAttribute("tabindex"), "-1");
});

test("the link sits after #filters and before #out in document order", () => {
  const link = document.querySelector('a[href="#results"]');
  const filters = document.getElementById("filters");
  const out = document.getElementById("out");
  const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING
  const PRECEDING = 2; // Node.DOCUMENT_POSITION_PRECEDING
  assert.ok(filters.compareDocumentPosition(link) & FOLLOWING, "link follows #filters");
  assert.ok(link.compareDocumentPosition(out) & FOLLOWING, "#out follows link");
  assert.ok(out.compareDocumentPosition(link) & PRECEDING, "link precedes #out");
  assert.equal(link.previousElementSibling, filters, "link is directly after the form");
});

test("the print stylesheet hides .noprint, which the link uses", () => {
  const start = css.indexOf("@media print");
  assert.ok(start >= 0, "print media block exists");
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) { end = i; break; }
  }
  const body = css.slice(open + 1, end);
  assert.match(body, /\.noprint[^{]*\{\s*display:\s*none\s*!important/);
});
