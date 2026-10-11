// Run with: node --test tests/r3-a11y-perf-25-reflow-long-strings.test.mjs
// WCAG reflow: at 320 CSS px the page must not scroll sideways. Long addresses in <code> and long
// link text have no spaces, so they must be allowed to break. This test checks that:
// 1. a screen rule (not inside @media print) gives overflow-wrap anywhere or break-word to code and to main;
// 2. every built root page's <code> text and every <a> text inside <main> that is longer than 40
//    characters with no space is covered by that rule;
// 3. html, body and .wrap never hide the problem with overflow-x hidden.
// The checks read the stylesheet and the built pages as text.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
// Comments removed so their text never reads as a selector or a declaration.
const CSS_ALL = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

// Returns the text between the "{" at openIdx and its matching "}".
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

// The stylesheet with every @media print block removed, so only screen rules remain.
function stripPrint(css) {
  let out = css;
  const re = /@media\s+print\s*\{/;
  let m;
  while ((m = re.exec(out))) {
    const open = m.index + m[0].length - 1;
    const end = open + braceBody(out, open).length + 2;
    out = out.slice(0, m.index) + out.slice(end);
  }
  return out;
}

// Flat rules (selector and declarations) found in a stylesheet text. Selectors starting with "@" are skipped.
function flatRules(css) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const selector = m[1].trim();
    if (selector.startsWith("@")) continue;
    const decls = {};
    for (const part of m[2].split(";")) {
      const idx = part.indexOf(":");
      if (idx < 0) continue;
      decls[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim().toLowerCase();
    }
    rules.push({ selectors: selector.split(",").map((s) => s.trim()), decls });
  }
  return rules;
}

const SCREEN_RULES = flatRules(stripPrint(CSS_ALL));
const WRAP_VALUES = ["anywhere", "break-word"];

// Screen rules that give a break-wrap value to the listed selector.
function wrapRulesFor(selectorMatches) {
  return SCREEN_RULES.filter(
    (r) => WRAP_VALUES.includes(r.decls["overflow-wrap"]) && r.selectors.some(selectorMatches)
  );
}

const CODE_RULES = wrapRulesFor((s) => s === "code");
const MAIN_RULES = wrapRulesFor((s) => s === "main" || s === "main a" || s === "body");

test("a screen rule (not in @media print) gives overflow-wrap to code and to main", () => {
  assert.ok(CODE_RULES.length >= 1, "no screen rule gives overflow-wrap: anywhere or break-word to code");
  assert.ok(MAIN_RULES.length >= 1, "no screen rule gives overflow-wrap: anywhere or break-word to main (or body)");
});

test("every long unbroken code and main link text on every built page is covered by the rule", () => {
  const pages = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".html"))
    .sort();
  assert.ok(pages.length > 0, "no built html pages found at the repo root");
  const uncovered = [];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(ROOT, page), "utf8");
    const mainMatch = html.match(/<main[\s\S]*?<\/main>/);
    const main = mainMatch ? mainMatch[0] : "";
    const codeTexts = [...html.matchAll(/<code\b[^>]*>([^<]*)<\/code>/g)].map((m) => m[1]);
    const linkTexts = [...main.matchAll(/<a\b[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
    for (const text of codeTexts) {
      const t = text.trim();
      if (t.length > 40 && !/\s/.test(t)) {
        if (CODE_RULES.length === 0) uncovered.push(`${page} code: ${t}`);
      }
    }
    for (const text of linkTexts) {
      const t = text.trim();
      if (t.length > 40 && !/\s/.test(t)) {
        if (MAIN_RULES.length === 0) uncovered.push(`${page} a: ${t}`);
      }
    }
  }
  assert.deepEqual(uncovered, [], "long unbroken text with no break rule");
});

test("html, body and .wrap do not hide overflow with overflow-x hidden", () => {
  const bad = [];
  for (const r of flatRules(CSS_ALL)) {
    const targets = r.selectors.filter((s) => ["html", "body", ".wrap"].includes(s));
    if (targets.length === 0) continue;
    const xHidden = r.decls["overflow-x"] === "hidden" || r.decls["overflow"] === "hidden";
    if (xHidden) bad.push(targets.join(", "));
  }
  assert.deepEqual(bad, [], "html, body or .wrap sets overflow-x: hidden");
});
