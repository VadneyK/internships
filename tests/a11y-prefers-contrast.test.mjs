// Run with: node --test tests/a11y-prefers-contrast.test.mjs
// Locks in the @media (prefers-contrast: more) block in assets/css/style.css. The block must:
// (a) set --ink-2 to the same color as --ink in light and dark mode,
// (b) turn off the speckle noise overlay (body::before),
// (c) not override any text color to a value below 4.5:1 on --paper or --surface.
// Reads the CSS from disk. No network, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");

// WCAG 2.x relative luminance and contrast ratio. Same math as tests/contrast.test.mjs (not exported there, so copied here).
function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Returns the text between the { and the matching } of the first rule that matches re (re must end with a literal "{").
function ruleBody(css, re) {
  const m = re.exec(css);
  if (!m) throw new Error(`rule not found: ${re}`);
  const open = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed block: ${re}`);
}

// Start and end index (end is exclusive) and body of the whole block whose header matches re, or null.
function blockRange(css, re) {
  const m = re.exec(css);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return { start: m.index, end: i + 1, body: css.slice(open + 1, i) };
    }
  }
  return null;
}

// True when the character at index sits outside every @media print block (same walk as tests/contrast.test.mjs).
function outsideMediaPrint(css, index) {
  const stack = [];
  let last = 0;
  for (let i = 0; i < index; i++) {
    const ch = css[i];
    if (ch === "{") {
      stack.push(css.slice(last, i).split("}").pop().trim());
      last = i + 1;
    } else if (ch === "}") {
      stack.pop();
      last = i + 1;
    } else if (ch === ";") {
      last = i + 1;
    }
  }
  return !stack.some((h) => h.includes("@media print"));
}

function customProps(body) {
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const mediaBody = ruleBody(CSS, /@media \(prefers-color-scheme: dark\)\s*\{/);
const light = customProps(ruleBody(CSS, /^:root\s*\{/m));
const darkMedia = customProps(ruleBody(mediaBody, /:root:not\(\[data-theme="light"\]\)\s*\{/));
const darkAttr = customProps(ruleBody(CSS, /^:root\[data-theme="dark"\]\s*\{/m));
const THEMES = { light, dark: { ...light, ...darkAttr } };

// Resolves a base token in a theme. A value of var(--name) follows the token of the same theme.
function resolveToken(theme, name, seen = new Set()) {
  const v = THEMES[theme][name];
  if (v === undefined) return undefined;
  const ref = /^var\(--([a-z0-9-]+)\)$/.exec(v);
  if (!ref) return v;
  if (seen.has(name)) return undefined;
  seen.add(name);
  return resolveToken(theme, ref[1], seen);
}

// Resolves a value written inside the prefers-contrast block, in a theme.
function resolveValue(theme, value) {
  const ref = /^var\(--([a-z0-9-]+)\)$/.exec(value);
  return ref ? resolveToken(theme, ref[1]) : value;
}

// Text tokens the block must not push below 4.5:1. Each is checked against --paper and --surface, in both themes.
const FOREGROUND = ["ink", "ink-2", "orange-text", "good", "warn", "bad", "focus"];

// Returns a list of problems with the prefers-contrast block. An empty list means the block passes.
function moreProblems(css) {
  const problems = [];
  const more = blockRange(css, /@media \(prefers-contrast: more\)\s*\{/);
  if (!more) return ["no @media (prefers-contrast: more) block"];
  if (!outsideMediaPrint(css, more.start)) problems.push("prefers-contrast block is inside @media print");

  // Rules inside the block: selector text and declarations.
  const rules = [...more.body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    decls: m[2],
  }));

  // (a) --ink-2 equals --ink in light and dark, and the rules reach the dark selectors too.
  const inkRules = rules.filter((r) => /--ink-2\s*:/.test(r.decls));
  if (inkRules.length === 0) {
    problems.push("block does not set --ink-2");
  } else {
    const sel = inkRules.map((r) => r.selector).join(" , ");
    if (!sel.includes(':root:not([data-theme="light"])')) problems.push("--ink-2 rule does not reach the dark prefers-color-scheme selector");
    if (!sel.includes(":root[data-theme")) problems.push("--ink-2 rule does not reach the data-theme selector");
    for (const r of inkRules) {
      const v = /--ink-2\s*:\s*([^;]+);/.exec(r.decls)[1].trim();
      for (const theme of ["light", "dark"]) {
        const got = resolveValue(theme, v);
        const inkHex = resolveToken(theme, "ink");
        if (got !== inkHex) problems.push(`--ink-2 is ${got} but --ink is ${inkHex} in ${theme}`);
      }
    }
  }

  // (b) the speckle overlay is turned off.
  const noise = rules.filter((r) => r.selector === "body::before");
  const offOk = noise.some((r) => /(^|;|\s)display\s*:\s*none\s*(;|$)/.test(r.decls) || /(^|;|\s)opacity\s*:\s*0\s*(;|$)/.test(r.decls));
  if (!offOk) problems.push("block does not turn off body::before (display: none or opacity: 0)");

  // (c) no overridden text color fails 4.5:1 on --paper or --surface.
  for (const r of rules) {
    for (const m of r.decls.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const name = m[1];
      if (!FOREGROUND.includes(name)) continue;
      for (const theme of ["light", "dark"]) {
        const value = resolveValue(theme, m[2].trim());
        if (value === undefined || !/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value)) {
          problems.push(`--${name} in ${theme} does not resolve to a hex color`);
          continue;
        }
        for (const bg of ["paper", "surface"]) {
          const ratio = contrast(value, resolveToken(theme, bg));
          if (ratio < 4.5) problems.push(`--${name} on --${bg} in ${theme} is ${ratio.toFixed(2)}:1`);
        }
      }
    }
  }
  return problems;
}

test("style.css has an @media (prefers-contrast: more) block outside @media print", () => {
  const more = blockRange(CSS, /@media \(prefers-contrast: more\)\s*\{/);
  assert.ok(more, "no @media (prefers-contrast: more) block in style.css");
  assert.ok(outsideMediaPrint(CSS, more.start), "block is inside @media print");
});

test("prefers-contrast: more block passes all checks (--ink-2 = --ink, speckle off, 4.5:1 text)", () => {
  assert.deepEqual(moreProblems(CSS), []);
});

test("prefers-contrast: more block sets --ink-2 to --ink, and the light and dark ink resolve to the same color", () => {
  const more = blockRange(CSS, /@media \(prefers-contrast: more\)\s*\{/);
  assert.match(more.body, /--ink-2\s*:\s*var\(--ink\)\s*;/);
  for (const theme of ["light", "dark"]) {
    assert.equal(resolveValue(theme, "var(--ink)"), resolveToken(theme, "ink"));
    assert.ok(resolveToken(theme, "ink"), `ink missing in ${theme}`);
  }
});

test("mutation check: deleting the prefers-contrast block fails the check", () => {
  const more = blockRange(CSS, /@media \(prefers-contrast: more\)\s*\{/);
  assert.ok(more, "block must exist before it can be removed");
  const mutated = CSS.slice(0, more.start) + CSS.slice(more.end);
  assert.notEqual(mutated, CSS, "mutation did not change the CSS");
  assert.notDeepEqual(moreProblems(mutated), []);
});

test("mutation check: removing the body::before rule from the block fails the check", () => {
  const mutated = CSS.replace("  body::before { display: none; }\n", "");
  assert.notEqual(mutated, CSS, "mutation did not change the CSS");
  assert.ok(moreProblems(mutated).some((p) => /body::before/.test(p)));
});

test("mutation check: a light --ink-2 that fails 4.5:1 on --surface fails the check", () => {
  const mutated = CSS.replace("--ink-2: var(--ink); }\n  body::before", "--ink-2: #d0cdc8; }\n  body::before");
  assert.notEqual(mutated, CSS, "mutation did not change the CSS");
  assert.ok(moreProblems(mutated).some((p) => /--ink-2 on --(paper|surface)/.test(p)));
});
