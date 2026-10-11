// Run with: node --test tests/a11y-print-pickers.test.mjs
// Locks in the print stylesheet rules that keep tap-tile pickers, the Show more pager,
// the parent-text row and the Menu button off paper, while the teen's chosen answer still prints.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const RAW = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

// Body text of the brace block that opens at index `open` (a "{" character).
function braceBody(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error("unclosed block in style.css");
}

// Every @media print block, with its body.
function printBlocks(css) {
  const out = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) out.push(braceBody(css, m.index + m[0].length - 1));
  assert.ok(out.length >= 1, "no @media print block found in style.css");
  return out;
}

// Flat rules inside a print block (the print blocks hold no nested braces).
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
      if (prop) decls[prop] = part.slice(idx + 1).trim();
    }
    const selectors = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    rules.push({ selectors, decls, raw: m[1].trim(), body: m[2] });
  }
  return rules;
}

const PRINT = printBlocks(CSS);
const RULES = PRINT.flatMap((body) => rulesIn(body));
const ALL_PRINT_TEXT = PRINT.join("\n");

// The selectors that some print rule sets to display: none (with or without !important).
function hiddenSelectors() {
  const set = new Set();
  for (const r of RULES) {
    const display = (r.decls.display || "").replace(/\s*!\s*important\s*$/i, "").trim();
    if (display === "none") r.selectors.forEach((s) => set.add(s));
  }
  return set;
}

test("print: unselected tap tiles are hidden", () => {
  assert.ok(hiddenSelectors().has('.tp .tile[aria-pressed="false"]'), 'no print rule hides .tp .tile[aria-pressed="false"]');
});

test("print: picker captions, pager, parent-text row and Menu button are hidden", () => {
  const hidden = hiddenSelectors();
  for (const sel of [".tp-cap", ".pager", ".share-parent", ".menu-btn"]) {
    assert.ok(hidden.has(sel), "no print rule hides " + sel);
  }
});

test("print: no rule hides the chosen answer or the page sections that hold it", () => {
  const hidden = hiddenSelectors();
  for (const sel of ['.tile[aria-pressed="true"]', ".tp", ".letter", ".resume", "main button"]) {
    assert.ok(!hidden.has(sel), "a print rule hides " + sel + " as a whole");
  }
});

test("print: the tile rule hides only unselected tiles, never the selected one", () => {
  const rule = RULES.find((r) => r.selectors.includes('.tp .tile[aria-pressed="false"]'));
  assert.ok(rule, "tile rule missing");
  for (const s of rule.selectors) {
    assert.ok(!/aria-pressed="true"/.test(s), "tile rule must not target the selected tile: " + s);
  }
});

test("print: the existing palette reset, @page margin, address rule and print-one rules are still present", () => {
  const root = RULES.find((r) => r.selectors.includes(":root") && r.selectors.includes(":root[data-theme]"));
  assert.ok(root, "print palette reset is missing");
  assert.match(root.decls["--paper"] || "", /#efede8/, "print palette --paper changed");
  assert.match(root.decls["--ink"] || "", /#151515/, "print palette --ink changed");
  assert.match(ALL_PRINT_TEXT, /@page\s*\{\s*margin:\s*12mm;?\s*\}/, "@page margin rule is missing");
  assert.match(ALL_PRINT_TEXT, /main a\[href\^="http"\]:not\(\.btn\):not\(\.noprint\)::after/, "address rule is missing");
  assert.match(ALL_PRINT_TEXT, /body\.print-one > \*:not\(#printRoot\)\s*\{\s*display:\s*none !important;?\s*\}/, "body.print-one hide rule is missing");
  assert.match(ALL_PRINT_TEXT, /body\.print-one #printRoot\s*\{\s*display:\s*block !important;?\s*\}/, "body.print-one show rule is missing");
});
