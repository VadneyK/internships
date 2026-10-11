// Run with: node --test tests/r2-a11y-perf-6-print.test.mjs
// Locks in the paper rules in assets/css/style.css: wide tables fit the page instead of being cut off,
// the table header row repeats on each page, rows do not split, headings stay with the text after them,
// and the page has a margin. The screen .tablewrap rule keeps its horizontal scroll.
// The checks read the stylesheet as text, in the same way as tests/print.dom.test.mjs.
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

// Every @media print block in the file, with its position and body.
function printBlocks(css) {
  const out = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    const open = m.index + m[0].length - 1;
    out.push({ start: m.index, body: braceBody(css, open) });
  }
  assert.ok(out.length >= 1, "no @media print block found in style.css");
  return out;
}

// Flat rules inside a print block. The print blocks have no nested braces, so one regex is enough.
function rulesIn(body) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(body))) {
    const decls = {};
    for (const part of m[2].split(";")) {
      const idx = part.indexOf(":");
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (prop) decls[prop] = value;
    }
    rules.push({ selector: m[1].trim(), selectors: m[1].split(",").map((s) => s.trim()), decls });
  }
  return rules;
}

// Strips a trailing !important and reports whether it was there.
function splitImportant(value) {
  const important = /!\s*important\s*$/i.test(value);
  return { value: value.replace(/\s*!\s*important\s*$/i, "").trim(), important };
}

// All print rules, flattened across every print block.
function allPrintRules(css) {
  const rules = [];
  for (const block of printBlocks(css)) {
    for (const r of rulesIn(block.body)) rules.push({ ...r, blockStart: block.start });
  }
  return rules;
}

// The print rule whose selector list includes the given selector exactly.
function printRuleFor(css, selector) {
  return allPrintRules(css).find((r) => r.selectors.includes(selector));
}

// Converts a CSS length such as "12mm" or "1.2cm" to millimetres. Returns NaN for other units.
function toMm(value) {
  const m = /^([0-9]*\.?[0-9]+)\s*(mm|cm|in|pt|px)$/i.exec(value.trim());
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "mm") return n;
  if (unit === "cm") return n * 10;
  if (unit === "in") return n * 25.4;
  if (unit === "pt") return n * 25.4 / 72;
  return n * 25.4 / 96; // px
}

test("paper: a print .tablewrap rule lets wide tables show in full (overflow: visible)", () => {
  const rule = printRuleFor(CSS, ".tablewrap");
  assert.ok(rule, "no print rule for .tablewrap found");
  assert.equal(splitImportant(rule.decls.overflow || "").value, "visible");
});

test("paper: the print table rule drops the 34rem minimum width and fills the page width", () => {
  const rule = printRuleFor(CSS, "table");
  assert.ok(rule, "no print rule for table found");
  const minWidth = splitImportant(rule.decls["min-width"] || "").value;
  assert.ok(minWidth === "0" || minWidth === "auto", `print table min-width should be 0 or auto, got "${minWidth}"`);
  assert.equal(splitImportant(rule.decls.width || "").value, "100%");
});

test("paper: the table header row repeats on each page (thead is table-header-group)", () => {
  const rule = printRuleFor(CSS, "thead");
  assert.ok(rule, "no print rule for thead found");
  assert.equal(splitImportant(rule.decls.display || "").value, "table-header-group");
});

test("paper: table rows do not split across pages", () => {
  const rule = printRuleFor(CSS, "tr");
  assert.ok(rule, "no print rule for tr found");
  const avoid =
    splitImportant(rule.decls["break-inside"] || "").value === "avoid" ||
    splitImportant(rule.decls["page-break-inside"] || "").value === "avoid";
  assert.ok(avoid, "print tr needs break-inside: avoid (or page-break-inside: avoid)");
});

test("paper: h1, h2 and h3 keep with the text after them (break-after: avoid)", () => {
  const rule = allPrintRules(CSS).find(
    (r) => r.selectors.includes("h1") && r.selectors.includes("h2") && r.selectors.includes("h3")
  );
  assert.ok(rule, "no print rule covering h1, h2 and h3 found");
  const avoid =
    splitImportant(rule.decls["break-after"] || "").value === "avoid" ||
    splitImportant(rule.decls["page-break-after"] || "").value === "avoid";
  assert.ok(avoid, "print headings need break-after: avoid (or page-break-after: avoid)");
});

test("paper: an @page rule sets a page margin of at least 10mm", () => {
  const pageRules = [];
  for (const block of printBlocks(CSS)) {
    const re = /@page\s*\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(block.body))) pageRules.push(m[1]);
  }
  assert.ok(pageRules.length >= 1, "no @page rule found inside a print block");
  const margins = pageRules.map((body) => {
    const decl = body.split(";").map((p) => p.trim()).find((p) => /^margin\s*:/.test(p));
    return decl ? decl.slice(decl.indexOf(":") + 1).trim() : "";
  });
  assert.ok(
    margins.some((v) => toMm(v) >= 10),
    `@page margin should be at least 10mm, got: ${JSON.stringify(margins)}`
  );
});

test("paper: the light palette reset is still in the print blocks", () => {
  const rule = allPrintRules(CSS).find(
    (r) => r.selectors.includes(":root") && r.selectors.includes(":root[data-theme]")
  );
  assert.ok(rule, "light palette reset for :root in print was removed");
  assert.equal(splitImportant(rule.decls["color-scheme"] || "").value, "light");
  assert.ok("--paper" in rule.decls, "print palette must still reset --paper");
});

test("paper: link addresses still print after links in main", () => {
  const rule = allPrintRules(CSS).find((r) => r.decls.content && r.decls.content.includes("attr(href)"));
  assert.ok(rule, "link address print rule was removed");
  assert.ok(rule.selector.startsWith('main a[href^="http"]'), `unexpected selector: ${rule.selector}`);
});

test("paper: screen .tablewrap still scrolls sideways outside print", () => {
  // The first .tablewrap rule in the file is the screen rule, not the print one.
  const idx = CSS.indexOf(".tablewrap {");
  assert.ok(idx >= 0, "screen .tablewrap rule not found");
  const screenBlockStart = CSS.indexOf("{", idx);
  const body = braceBody(CSS, screenBlockStart);
  const decls = rulesIn(`x{${body}}`)[0].decls;
  assert.equal(splitImportant(decls["overflow-x"] || "").value, "auto");
  assert.ok(idx < printBlocks(CSS)[0].start, "first .tablewrap rule should sit before the print block, outside print");
});
