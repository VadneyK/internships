// Run with: node --test tests/r4-a11y-perf-1-focus-ring-surfaces.test.mjs
// Ticket r2-a11y-perf-1: the keyboard focus ring must stay visible on every surface a focusable control can sit on.
// The ring is the :focus-visible outline in assets/css/style.css. Its color comes from --focus, which is #0b57d0 in
// light mode and #8ab4ff in dark mode. Two surfaces need their own ring color:
//   - the yellow callout (#f6c431, both themes): a link inside it gets the dark blue ring
//   - the always-dark footer (#0d0c0c, both themes): a link inside it gets the light blue ring
// Every pair is checked at WCAG 3:1 (1.4.11 non-text contrast, 2.4.7 focus visible).
//
// --tag-bg is NOT a ring surface and is left out on purpose. The base ring has outline-offset 3px, so it is drawn on
// the page around a control, not on the control's own fill. A chip, tile, dark button or the current nav link that
// is filled with --tag-bg therefore has its ring on --paper, which the check above covers. No focusable element in
// src/ or assets/js/ is drawn inside a --tag-bg container. The last test guards the offset that makes this true.
//
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

// Top-level style rules only (at-rule blocks such as @media print are skipped, so a rule found here is not inside one).
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
    if (!prelude.startsWith("@")) {
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

// Body of the brace block that opens at index `open`.
function bodyAt(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error("unclosed block");
}
function block(css, re) {
  const m = re.exec(css);
  assert.ok(m, `rule not found: ${re}`);
  return bodyAt(css, m.index + m[0].length - 1);
}
function props(body) {
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const light = props(block(CSS, /^:root\s*\{/m));
const dark = { ...light, ...props(block(CSS, /^:root\[data-theme="dark"\]\s*\{/m)) };
const THEMES = { light, dark };

function resolve(value, theme) {
  const v = value.trim();
  const m = /^var\(--([a-z0-9-]+)\)$/.exec(v);
  if (m) {
    const t = THEMES[theme][m[1]];
    assert.ok(t !== undefined, `token --${m[1]} missing in ${theme} theme`);
    return resolve(t, theme);
  }
  assert.ok(/^#[0-9a-fA-F]{6}$/.test(v), `not a hex color: ${v}`);
  return v;
}

// Last top-level declaration of a property for one selector, or undefined.
function declared(selector, prop) {
  const hits = RULES.filter((r) => r.selector === selector && r.decls[prop] !== undefined);
  return hits.length ? hits[hits.length - 1].decls[prop] : undefined;
}

const CALLOUT_RING = ".callout:not(.plain):not(.warn):not(.bad) :focus-visible";
const FOOT_RING = ".foot :focus-visible";
const YELLOW = "#f6c431";
const FOOTER = "#0d0c0c";

// Each surface: its fill in a theme, and the override selector that sets the ring on it (null = base --focus).
const SURFACES = [
  { name: "--paper", fill: "var(--paper)", override: null },
  { name: "--paper-2", fill: "var(--paper-2)", override: null },
  { name: "--surface", fill: "var(--surface)", override: null },
  { name: "yellow callout", fill: YELLOW, override: CALLOUT_RING },
  { name: "dark footer", fill: FOOTER, override: FOOT_RING },
];

// The ring color that applies on a surface in a theme. Fails by name if the override rule is missing.
function ringOn(surface, theme) {
  if (!surface.override) return resolve("var(--focus)", theme);
  const value = declared(surface.override, "outline-color");
  assert.ok(value, `no outline-color rule for ${surface.name} (${surface.override}) in style.css`);
  return resolve(value, theme);
}

for (const theme of ["light", "dark"]) {
  test(`r2-a11y-perf-1: the focus ring is at least 3:1 on every ring surface in ${theme} mode`, () => {
    for (const surface of SURFACES) {
      const ring = ringOn(surface, theme);
      const fill = resolve(surface.fill, theme);
      const ratio = contrast(ring, fill);
      assert.ok(
        ratio >= 3,
        `${theme}: focus ring ${ring} on ${surface.name} ${fill} is ${ratio.toFixed(2)}:1, needs 3:1`
      );
    }
  });
}

test("r2-a11y-perf-1: the callout and footer ring overrides exist at top level, not inside @media print", () => {
  for (const sel of [CALLOUT_RING, FOOT_RING]) {
    assert.ok(RULES.some((r) => r.selector === sel && r.decls["outline-color"]), `top-level rule with outline-color missing: ${sel}`);
  }
  const printBlocks = [...CSS.matchAll(/@media print\s*\{/g)].map((m) => bodyAt(CSS, m.index + m[0].length - 1));
  assert.ok(printBlocks.length > 0, "expected at least one @media print block in style.css");
  for (const sel of [CALLOUT_RING, FOOT_RING]) {
    for (const body of printBlocks) {
      assert.ok(!body.includes(sel), `${sel} must not be inside an @media print block`);
    }
  }
});

test("r2-a11y-perf-1: the base ring sits outside its control (outline-offset 2px or more), so a tag-bg control's ring lands on the page", () => {
  const offset = declared(":focus-visible", "outline-offset");
  assert.ok(offset, "base :focus-visible rule has no outline-offset");
  assert.ok(parseFloat(offset) >= 2, `base :focus-visible outline-offset is ${offset}, needs at least 2px`);
});
