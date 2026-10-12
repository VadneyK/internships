// Run with: node --test tests/a11y-state-contrast.test.mjs
// Table-driven contrast check for interactive states in assets/css/style.css, in light and dark theme.
// contrast.test.mjs checks plain token pairs. This test checks what each control really shows in each state:
// default, :hover and [aria-pressed="true"] for chips, tiles, buttons and stars, the current nav link,
// footer links on the dark footer, and links inside callouts.
// For each state it reads the CSS rules that apply, resolves var(--token) for the theme, then asserts
// text at least 4.5:1 and a 2px or wider visible border at least 3:1, both against the page background.
// If a selector in the table is missing from the CSS, the test fails and names the state.
// Reads the CSS from disk. No network, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");

function parseHex(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
function luminance(hex) {
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = parseHex(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Top-level (outside any at-rule) style rules, comments stripped. The theme blocks are read separately.
function topLevelRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let start = 0;
  let i = 0;
  while (i < src.length) {
    if (src[i] !== "{") { i++; continue; }
    const prelude = src.slice(start, i).trim();
    let depth = 0;
    let j = i;
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}" && --depth === 0) break;
    }
    if (prelude.startsWith("@media (hover: hover)")) {
      // Hover-only rules are wrapped in this block (ticket r2-a11y-perf-2). Read them as top-level rules.
      for (const r of topLevelRules(src.slice(i + 1, j))) rules.push({ ...r, order: rules.length });
    } else if (!prelude.startsWith("@")) {
      const decls = {};
      for (const part of src.slice(i + 1, j).split(";")) {
        const k = part.indexOf(":");
        if (k > 0) decls[part.slice(0, k).trim()] = part.slice(k + 1).trim();
      }
      for (const sel of prelude.split(",").map((s) => s.trim())) rules.push({ selector: sel, decls, order: rules.length });
    }
    i = j + 1;
    start = i;
  }
  return rules;
}
const RULES = topLevelRules(CSS);

function block(css, re) {
  const m = re.exec(css);
  assert.ok(m, `rule not found: ${re}`);
  const open = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unclosed block: ${re}`);
}
function props(body) {
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const light = props(block(CSS, /^:root\s*\{/m));
const dark = { ...light, ...props(block(CSS, /^:root\[data-theme="dark"\]\s*\{/m)) };
const THEMES = { light, dark };

// Resolve "var(--x)" or a hex literal to a hex color. Returns null for transparent or unknown values.
function resolve(value, theme) {
  if (value === undefined) return null;
  const v = value.trim();
  const m = /^var\(--([a-z0-9-]+)\)$/.exec(v);
  if (m) {
    const t = THEMES[theme][m[1]];
    assert.ok(t !== undefined, `token --${m[1]} missing in ${theme} theme`);
    return resolve(t, theme);
  }
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{6})?$|^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}

// Cascade one property across the rules for the listed selectors: later in the list wins, which is
// how the table is written (base selector first, then the state). Returns undefined when none set it.
function cascade(selectors, prop) {
  let found;
  for (const sel of selectors) {
    const hits = RULES.filter((r) => r.selector === sel && r.decls[prop] !== undefined);
    if (hits.length) found = hits[hits.length - 1].decls[prop];
  }
  return found;
}
function missing(selectors) {
  return selectors.filter((s) => !RULES.some((r) => r.selector === s));
}

const PAGE = "paper"; // page background token the borders and transparent controls sit on

// The table of checked states. Each row: a name, the selectors whose rules apply (base first, state last),
// and what the text and 2px border sit on. bg: "own" uses the rule's own background (falls back to the page
// background when the control has none), or a fixed { token | hex } for links that sit on a parent's background.
// border: true asserts the border against the page background at 3:1 when the rule gives a visible 2px or wider border.
const STATES = [
  ...["chip", "tile"].flatMap((c) => [
    { name: `.${c} default`, sel: [`.${c}`], border: true },
    { name: `.${c}:hover`, sel: [`.${c}`, `.${c}:hover`], border: true },
    { name: `.${c}[aria-pressed=true]`, sel: [`.${c}`, `.${c}[aria-pressed="true"]`], border: true },
  ]),
  { name: ".chip.zero default", sel: [".chip", ".chip.zero"], border: true },
  { name: ".chip.zero:hover", sel: [".chip", ".chip.zero", ".chip:hover"], border: true },
  { name: ".chip.zero[aria-pressed=true]", sel: [".chip", ".chip.zero", ".chip[aria-pressed=\"true\"]", ".chip.zero[aria-pressed=\"true\"]"], border: true },
  { name: ".btn default", sel: [".btn"], border: true },
  { name: ".btn:hover", sel: [".btn", ".btn:hover"], border: true },
  { name: ".btn.alt default", sel: [".btn", ".btn.alt"], border: true },
  { name: ".btn.alt:hover", sel: [".btn", ".btn.alt", ".btn:hover", ".btn.alt:hover"], border: true },
  { name: ".btn.dark default", sel: [".btn", ".btn.dark"], border: true },
  { name: ".btn.dark:hover", sel: [".btn", ".btn.dark", ".btn:hover", ".btn.dark:hover"], border: true },
  { name: ".star default", sel: [".star"], border: true },
  { name: ".star[aria-pressed=true]", sel: [".star", ".star[aria-pressed=\"true\"]"], border: true },
  { name: ".nav a default", sel: [".nav a"], border: true },
  { name: ".nav a:hover", sel: [".nav a", ".nav a:hover"], border: true },
  { name: ".nav a[aria-current=page]", sel: [".nav a", ".nav a[aria-current=\"page\"]"], border: true },
  { name: ".foot a", sel: [".foot a"], on: "foot" },
  { name: ".foot a:hover", sel: [".foot a", ".foot a:hover"], on: "foot" },
  { name: ".callout a (yellow)", sel: [".callout:not(.plain):not(.warn):not(.bad) a"], on: "yellow" },
  { name: ".callout a:hover (yellow)", sel: [".callout:not(.plain):not(.warn):not(.bad) a", ".callout:not(.plain):not(.warn):not(.bad) a:hover"], on: "yellow" },
  { name: ".callout.plain a", sel: [".callout.plain"], on: "token:surface" },
  { name: ".callout.warn a", sel: [".callout.warn a"], on: "token:warn-bg" },
  { name: ".callout.bad a", sel: [".callout.bad a"], on: "token:bad-bg" },
];

function ratioProblems(state, theme) {
  const problems = [];
  const bgDecl = (cascade(state.sel, "background") ?? cascade(state.sel, "background-color"));
  let bg;
  if (state.on === "foot") bg = resolve(cascade([".foot"], "background"), theme);
  else if (state.on === "yellow") bg = resolve(cascade([".callout"], "background"), theme);
  else if (state.on && state.on.startsWith("token:")) bg = resolve(`var(--${state.on.slice(6)})`, theme);
  else bg = resolve(bgDecl, theme) ?? resolve(`var(--${PAGE})`, theme);
  let fg = resolve(cascade(state.sel, "color"), theme);
  if (!fg && state.inherit) fg = resolve(cascade([state.inherit], "color"), theme);
  if (!fg && state.on === "foot") fg = resolve(cascade([".foot"], "color"), theme);
  if (!fg) fg = resolve("var(--ink)", theme); // body text color is the inherited default
  const r = contrast(fg, bg);
  if (r < 4.5) problems.push(`${state.name} text ${fg} on ${bg} in ${theme} is ${r.toFixed(2)}:1, needs 4.5:1`);
  if (state.border) {
    const m = /^(\d+(?:\.\d+)?)px\s+solid\s+(.+)$/.exec(cascade(state.sel, "border") ?? "");
    const edge = m && Number(m[1]) >= 2 ? resolve(m[2], theme) : null;
    if (edge) {
      const page = resolve(`var(--${PAGE})`, theme);
      const br = contrast(edge, page);
      if (br < 3) problems.push(`${state.name} border ${edge} on page ${page} in ${theme} is ${br.toFixed(2)}:1, needs 3:1`);
    }
  }
  return problems;
}

test("every state in the table exists in style.css", () => {
  const gone = [];
  for (const s of STATES) {
    const m = missing(s.sel.concat(s.inherit ? [s.inherit] : []));
    if (m.length) gone.push(`${s.name}: no CSS rule for ${m.join(", ")}`);
  }
  assert.deepEqual(gone, []);
});

test("the table covers .chip, .tile, .btn, .star, .nav a, .foot a and .callout a with default, hover and pressed", () => {
  const names = STATES.map((s) => s.name).join("|");
  for (const want of [".chip default", ".chip:hover", ".chip[aria-pressed=true]", ".tile:hover", ".tile[aria-pressed=true]", ".btn:hover", ".star[aria-pressed=true]", ".nav a[aria-current=page]", ".foot a:hover", ".callout a (yellow)"]) {
    assert.ok(names.includes(want), `table is missing ${want}`);
  }
});

for (const theme of ["light", "dark"]) {
  for (const state of STATES) {
    test(`${theme}: ${state.name} text is 4.5:1 and its border is 3:1 against the page`, () => {
      assert.deepEqual(ratioProblems(state, theme), []);
    });
  }
}

test("mutation check: a state with a bad hover color is reported by name", () => {
  const bad = { name: ".chip:hover (mutated)", sel: [".chip"], border: false };
  const saved = RULES.find((r) => r.selector === ".chip");
  const old = saved.decls.color;
  saved.decls.color = "#e4e1da";
  try {
    assert.notDeepEqual(ratioProblems(bad, "light"), []);
  } finally {
    saved.decls.color = old;
  }
});
