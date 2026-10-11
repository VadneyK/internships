// Run with: node --test tests/r3-a11y-perf-3-print-backgrounds.test.mjs
// Browsers drop background colors on paper unless the page asks to keep them. The print block sets
// --tag-bg to dark and --tag-fg to white, so tag labels must keep their fill when printed.
// This test reads style.css as text and checks the print rules. The screen rules are not touched.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
// Comments removed so their text never reads as a selector or a declaration.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

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

// Every @media print block in the file, as bodies.
function printBodies(css) {
  const out = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    out.push(braceBody(css, m.index + m[0].length - 1));
  }
  assert.ok(out.length >= 1, "no @media print block found in style.css");
  return out;
}

// Flat rules inside a print block: { selectors, decls }. Print blocks here have no nested braces.
function rulesIn(body) {
  return body
    .split("}")
    .map((chunk) => chunk.split("{"))
    .filter((parts) => parts.length === 2 && parts[0].trim() !== "")
    .map(([sel, decls]) => ({
      selectors: sel.split(",").map((s) => s.trim().replace(/\s+/g, " ")),
      decls: decls.trim(),
    }));
}

const PRINT = printBodies(CSS);
const PRINT_RULES = PRINT.flatMap((body) => rulesIn(body));

const KEEP_COLOR_SELECTORS = [".tag", ".k1", ".k2", ".k3", ".bar", ".meter > i", '.tile[aria-pressed="true"]'];

test("print block keeps background colors for tags, chart fills, meter and chosen tile", () => {
  const keepRules = PRINT_RULES.filter((r) =>
    /print-color-adjust\s*:\s*exact/.test(r.decls)
  );
  const covered = new Set();
  for (const rule of keepRules) {
    for (const sel of rule.selectors) covered.add(sel);
  }
  for (const sel of KEEP_COLOR_SELECTORS) {
    assert.ok(covered.has(sel), `print rule with print-color-adjust: exact must cover ${sel}`);
  }
});

test("print-color-adjust exact is set in both the standard and webkit forms for those selectors", () => {
  const keepRule = PRINT_RULES.find((r) => r.selectors.includes(".tag"));
  assert.ok(keepRule, "no print rule for .tag");
  assert.match(keepRule.decls, /(^|[;\s])print-color-adjust\s*:\s*exact/);
  assert.match(keepRule.decls, /-webkit-print-color-adjust\s*:\s*exact/);
});

test("no print rule leaves .tag text on var(--tag-fg) over a transparent background", () => {
  for (const rule of PRINT_RULES) {
    if (!rule.selectors.includes(".tag")) continue;
    const setsFgVar = /(^|[;\s])color\s*:\s*var\(--tag-fg\)/.test(rule.decls);
    const transparent = /background(-color)?\s*:\s*transparent/.test(rule.decls);
    assert.ok(!(setsFgVar && transparent), `print .tag rule has white text on transparent: ${rule.decls}`);
  }
});

test("the keep-color rule lives inside @media print, not on screen", () => {
  const inPrint = PRINT.some((body) => /print-color-adjust\s*:\s*exact/.test(body));
  assert.ok(inPrint, "print-color-adjust: exact must be inside @media print");
  // The screen rule for .tag must not carry the print-only flag.
  const screenTag = CSS.replace(/@media\s+print\s*\{[\s\S]*?\n\}/g, "");
  assert.ok(!/print-color-adjust/.test(screenTag), "print-color-adjust must not appear outside @media print");
});
