// Run with: node --test tests/r1-a11y-perf-9-print-page-breaks.test.mjs
// Locks in the paper page-break rules in assets/css/style.css: callouts, month blocks, people cards,
// numbered steps and fact boxes stay whole on one page; h4 and summary keep with the text after them;
// paragraphs and list items keep at least 3 lines at a page end and at a page start.
// The rules must sit inside @media print and must not appear on screen.
// The checks read the stylesheet as text, in the same way as tests/r2-a11y-perf-6-print.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
// Comments removed so their text never reads as a selector or a declaration.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");
const SRC_DIR = path.join(ROOT, "src");
const SRC_TEXT = fs
  .readdirSync(SRC_DIR)
  .filter((f) => f.endsWith(".html"))
  .map((f) => fs.readFileSync(path.join(SRC_DIR, f), "utf8"))
  .join("\n");

const BREAK_INSIDE_SELECTORS = [".callout", ".person", ".month", ".steps > li", ".facts > div"];

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

// Every @media print block in the file, with its position and body.
function printBlocks(css) {
  const out = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    const open = m.index + m[0].length - 1;
    out.push({ start: m.index, end: open + braceBody(css, open).length + 2, body: braceBody(css, open) });
  }
  assert.ok(out.length >= 1, "no @media print block found in style.css");
  return out;
}

// Flat rules inside a print block. The print blocks have no nested braces except @page, which is skipped here.
function rulesIn(body) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(body))) {
    const selector = m[1].trim();
    if (selector.startsWith("@")) continue;
    const decls = {};
    for (const part of m[2].split(";")) {
      const idx = part.indexOf(":");
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (prop) decls[prop] = value;
    }
    rules.push({ selector, selectors: selector.split(",").map((s) => s.trim()), decls });
  }
  return rules;
}

// Strips a trailing !important and reports the bare value.
function bareValue(value) {
  return (value || "").replace(/\s*!\s*important\s*$/i, "").trim();
}

// All print rules, flattened across every print block.
function allPrintRules(css) {
  const rules = [];
  for (const block of printBlocks(css)) {
    for (const r of rulesIn(block.body)) rules.push(r);
  }
  return rules;
}

// The print rule whose selector list includes the given selector exactly.
function printRuleFor(css, selector) {
  return allPrintRules(css).find((r) => r.selectors.includes(selector));
}

// The stylesheet with every @media print block removed: what a screen sees.
function screenCss(css) {
  let out = css;
  for (const block of printBlocks(css).reverse()) {
    out = out.slice(0, block.start) + out.slice(block.end);
  }
  return out;
}

test("breaks: each selector that must stay whole appears in style.css or a source page", () => {
  for (const sel of [...BREAK_INSIDE_SELECTORS, "h4", "summary", "p", "li"]) {
    const inCss = CSS.includes(sel);
    const inSrc = SRC_TEXT.includes(sel.replace(/ > /, "")) || SRC_TEXT.includes(sel);
    assert.ok(inCss || inSrc, `selector "${sel}" appears in neither style.css nor src/*.html`);
  }
});

for (const sel of BREAK_INSIDE_SELECTORS) {
  test(`breaks: a print rule keeps ${sel} whole (break-inside: avoid)`, () => {
    const rule = printRuleFor(CSS, sel);
    assert.ok(rule, `no print rule for ${sel} found`);
    assert.equal(bareValue(rule.decls["break-inside"]), "avoid", `print ${sel} needs break-inside: avoid`);
  });
}

test("breaks: h4 and summary keep with the text after them (break-after: avoid)", () => {
  const rule = allPrintRules(CSS).find((r) => r.selectors.includes("h4") && r.selectors.includes("summary"));
  assert.ok(rule, "no print rule covering h4 and summary found");
  const avoid =
    bareValue(rule.decls["break-after"]) === "avoid" || bareValue(rule.decls["page-break-after"]) === "avoid";
  assert.ok(avoid, "print h4 and summary need break-after: avoid (or page-break-after: avoid)");
});

test("breaks: p and li have orphans: 3 and widows: 3 in print", () => {
  const rule = allPrintRules(CSS).find((r) => r.selectors.includes("p") && r.selectors.includes("li"));
  assert.ok(rule, "no print rule covering p and li found");
  assert.equal(bareValue(rule.decls.orphans), "3", "print p and li need orphans: 3");
  assert.equal(bareValue(rule.decls.widows), "3", "print p and li need widows: 3");
});

test("guard: the page-break rules are inside @media print", () => {
  // Each rule the test relies on must be found in a print body, not only somewhere in the file.
  const printBodies = printBlocks(CSS).map((b) => b.body).join("\n");
  for (const sel of BREAK_INSIDE_SELECTORS) {
    assert.ok(printBodies.includes(sel), `${sel} break rule is not inside a print block`);
  }
  assert.ok(printBodies.includes("h4, summary {"), "h4 and summary break rule is not inside a print block");
  assert.ok(printBodies.includes("p, li {"), "p and li orphans and widows rule is not inside a print block");
});

test("guard: none of the page-break rules leak to screen", () => {
  const screen = screenCss(CSS);
  for (const sel of BREAK_INSIDE_SELECTORS) {
    const leak = new RegExp(`(^|[},\\s])${sel.replace(/[.*+?^${}()|[\]\\>]/g, "\\$&")}\\s*\\{[^}]*break-inside\\s*:\\s*avoid`);
    assert.ok(!leak.test(screen), `${sel} has break-inside: avoid outside @media print`);
  }
  assert.ok(!/(^|[},\s])h4\s*,\s*summary\s*\{[^}]*break-after\s*:\s*avoid/.test(screen), "h4 and summary break-after leaks to screen");
  assert.ok(!/orphans\s*:/.test(screen), "orphans leaks to screen");
  assert.ok(!/widows\s*:/.test(screen), "widows leaks to screen");
});
