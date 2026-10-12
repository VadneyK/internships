// Run with: node --test tests/r1-a11y-perf-1-nav-current-forced-colors.test.mjs
// Ticket r1-a11y-perf-1: in Windows High Contrast (forced-colors) mode the browser drops background fills,
// so the current page link in the top nav (.nav a[aria-current="page"]) would show no difference from the
// other links. The @media (forced-colors: active) block in assets/css/style.css must give that link the same
// Highlight / HighlightText pair the chip rule uses, and the rule must not sit inside @media print.
// Reads the CSS from disk. No network, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
// Comments removed so their text never reads as a selector or a declaration.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

// Text between the "{" at openIdx and its matching "}".
function braceBody(css, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(openIdx + 1, i);
    }
  }
  throw new Error("unclosed block in style.css");
}

// Every @media block whose query matches re, with its start index and body.
function mediaBlocks(css, re) {
  const out = [];
  const g = new RegExp(re.source, "g");
  let m;
  while ((m = g.exec(css))) {
    const open = m.index + m[0].length - 1;
    const body = braceBody(css, open);
    out.push({ start: m.index, end: open + body.length + 2, body });
  }
  return out;
}

// Flat rules inside a block that has no nested braces.
function rulesIn(body) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(body))) {
    const decls = {};
    for (const part of m[2].split(";")) {
      const idx = part.indexOf(":");
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (prop) decls[prop] = value;
    }
    rules.push({ selector: m[1].trim(), decls });
  }
  return rules;
}

const FORCED_RE = /@media\s*\(\s*forced-colors\s*:\s*active\s*\)\s*\{/;
const PRINT_RE = /@media\s+print\s*\{/;

const forced = mediaBlocks(CSS, FORCED_RE);
const forcedRules = forced.flatMap((b) => rulesIn(b.body));
const navRule = forcedRules.find((r) => r.selector === '.nav a[aria-current="page"]');

test("the forced-colors block has a .nav a[aria-current=\"page\"] rule", () => {
  assert.ok(forced.length >= 1, "no @media (forced-colors: active) block in style.css");
  assert.ok(navRule, 'no .nav a[aria-current="page"] rule inside the forced-colors block');
});

test("the nav current-page rule turns off forced-color-adjust, and uses Highlight and HighlightText", () => {
  assert.equal(navRule.decls["forced-color-adjust"], "none", "forced-color-adjust must be none");
  assert.equal(navRule.decls["background"], "Highlight", "background must be Highlight");
  assert.equal(navRule.decls["color"], "HighlightText", "color must be HighlightText");
});

test("the nav current-page rule matches the chip rule pattern", () => {
  const chip = forcedRules.find((r) => r.selector === '.chip[aria-pressed="true"]');
  assert.ok(chip, "chip rule missing from the forced-colors block");
  for (const prop of ["forced-color-adjust", "background", "color"]) {
    assert.equal(navRule.decls[prop], chip.decls[prop], `${prop} differs from the chip rule`);
  }
});

test("the nav current-page rule is not inside @media print", () => {
  const printBlocks = mediaBlocks(CSS, PRINT_RE);
  assert.ok(printBlocks.length >= 1, "no @media print block found in style.css");
  const navIdx = CSS.indexOf('.nav a[aria-current="page"]', forced[0].start);
  assert.ok(navIdx > forced[0].start, "nav rule is not after the forced-colors block start");
  for (const p of printBlocks) {
    assert.ok(!(navIdx >= p.start && navIdx < p.end), "the nav current-page rule sits inside @media print");
    assert.ok(!(forced[0].start >= p.start && forced[0].start < p.end), "the forced-colors block sits inside @media print");
  }
});
