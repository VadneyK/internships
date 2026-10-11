// Ticket r2-a11y-perf-7: in Windows High Contrast (forced-colors) mode the browser replaces background colors,
// so a pressed chip or saved star must show its state some other way. The forced-colors block in
// assets/css/style.css uses system color keywords and gives :focus-visible a thick outline.
// Run with: node --test tests/r2-a11y-perf-7.test.mjs
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

// Every @media (forced-colors: active) block, with its position and body.
function forcedBlocks(css) {
  const out = [];
  const re = /@media\s*\(\s*forced-colors\s*:\s*active\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    const open = m.index + m[0].length - 1;
    out.push({ start: m.index, end: open + braceBody(css, open).length + 2, body: braceBody(css, open) });
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

// Returns a list of problems with the forced-colors block. An empty list means the block meets the ticket.
function forcedColorProblems(css) {
  const problems = [];
  const blocks = forcedBlocks(css);
  if (blocks.length === 0) {
    problems.push("no @media (forced-colors: active) block");
    return problems;
  }
  const body = blocks[0].body;
  const rules = rulesIn(body);

  const chip = rules.find((r) => r.selector === '.chip[aria-pressed="true"]');
  if (!chip) problems.push('no .chip[aria-pressed="true"] rule in the block');
  else {
    if (chip.decls["forced-color-adjust"] !== "none") problems.push("chip rule: forced-color-adjust is not none");
    if (chip.decls["background"] !== "Highlight") problems.push("chip rule: background is not Highlight");
    if (chip.decls["color"] !== "HighlightText") problems.push("chip rule: color is not HighlightText");
  }

  const star = rules.find((r) => r.selector === '.star[aria-pressed="true"]');
  if (!star) problems.push('no .star[aria-pressed="true"] rule in the block');
  else {
    if (star.decls["forced-color-adjust"] !== "none") problems.push("star rule: forced-color-adjust is not none");
    if (star.decls["background"] !== "Highlight") problems.push("star rule: background is not Highlight");
    if (star.decls["color"] !== "HighlightText") problems.push("star rule: color is not HighlightText");
  }

  const focus = rules.find((r) => r.selector === ":focus-visible");
  if (!focus) problems.push("no :focus-visible rule in the block");
  else {
    const outline = focus.decls["outline"] || "";
    const width = outline.match(/(\d+(?:\.\d+)?)px/);
    const colorOk = /\b(Highlight|CanvasText)\b/.test(outline);
    if (!colorOk) problems.push(`focus outline color is not Highlight or CanvasText: "${outline}"`);
    if (!width || Number(width[1]) < 3) problems.push(`focus outline width is under 3px: "${outline}"`);
  }

  // System color keywords only: no hex color and no rgb() or hsl() value anywhere in the block.
  if (/#[0-9a-fA-F]{3,8}\b/.test(body)) problems.push("hex color inside the forced-colors block");
  if (/\b(rgba?|hsla?)\s*\(/i.test(body)) problems.push("rgb() or hsl() value inside the forced-colors block");

  return problems;
}

test("style.css has an @media (forced-colors: active) block with comments stripped", () => {
  assert.ok(forcedBlocks(CSS).length >= 1, "no @media (forced-colors: active) block in style.css");
});

test("the forced-colors block keeps pressed chips, pressed stars and focus visible", () => {
  assert.deepEqual(forcedColorProblems(CSS), []);
});

test("the forced-colors block has no hex or rgb value", () => {
  const body = forcedBlocks(CSS)[0].body;
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(body), false, "hex color found in block");
  assert.equal(/\b(rgba?|hsla?)\s*\(/i.test(body), false, "rgb() or hsl() found in block");
});

test("the earlier .chip[aria-pressed=\"true\"] rule is still there, unchanged", () => {
  assert.ok(
    CSS.includes('.chip[aria-pressed="true"] { background: var(--tag-bg); color: var(--tag-fg); }'),
    "the normal-mode chip rule changed or is missing"
  );
});

test("the earlier .star[aria-pressed=\"true\"] rule is still there, unchanged", () => {
  assert.ok(
    CSS.includes('.star[aria-pressed="true"] { background: var(--yellow); color: #151515; }'),
    "the normal-mode star rule changed or is missing"
  );
});

test("mutation: removing the forced-colors block makes the check fail", () => {
  const blocks = forcedBlocks(CSS);
  assert.ok(blocks.length >= 1, "precondition: block must exist before mutation");
  const { start, end } = blocks[0];
  const mutated = CSS.slice(0, start) + CSS.slice(end);
  assert.ok(forcedBlocks(mutated).length === 0, "mutation did not remove the block");
  const problems = forcedColorProblems(mutated);
  assert.ok(problems.length > 0, "check passed on CSS with the block removed");
});

test("mutation: a hex color inside the block makes the check fail", () => {
  const mutated = CSS.replace(
    ".chip[aria-pressed=\"true\"] { forced-color-adjust: none; background: Highlight;",
    ".chip[aria-pressed=\"true\"] { forced-color-adjust: none; background: #ffff00;"
  );
  assert.notEqual(mutated, CSS, "mutation did not apply");
  assert.ok(forcedColorProblems(mutated).some((p) => /hex|background/.test(p)), "hex color was not caught");
});

test("mutation: a 2px focus outline makes the check fail", () => {
  const mutated = CSS.replace(
    ":focus-visible { outline: 3px solid Highlight;",
    ":focus-visible { outline: 2px solid Highlight;"
  );
  assert.notEqual(mutated, CSS, "mutation did not apply");
  assert.ok(forcedColorProblems(mutated).some((p) => /width/.test(p)), "thin outline was not caught");
});
