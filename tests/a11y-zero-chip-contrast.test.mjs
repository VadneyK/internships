// Run with: node --test tests/a11y-zero-chip-contrast.test.mjs
// Checks the count text inside filter chips and tiles (".chip .n", ".tile .n") in assets/css/style.css.
// An opacity below 1 blends the text with its background, so contrast.test.mjs (token pairs only) cannot see it.
// This test finds every top-level rule that sets opacity on a ".n" count, blends the text color with the
// background for every chip or tile state (zero, pressed, hover) in light and dark mode, and asserts 4.5:1.
// Reads the CSS from disk. No network, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS_PATH = path.join(ROOT, "assets/css/style.css");
const CSS = fs.readFileSync(CSS_PATH, "utf8");
const MIN_RATIO = 4.5;

// WCAG 2.x relative luminance and contrast ratio.
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

// Blend a foreground hex over a background hex the way a browser does for an element with opacity.
function blend(fg, bg, alpha) {
  const parse = (hex) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const f = parse(fg);
  const b = parse(bg);
  const mix = f.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i]));
  return "#" + mix.map((c) => c.toString(16).padStart(2, "0")).join("");
}

// Strip comments, then return the top-level (not inside @media or other at-rules) style rules.
// Each rule has its selectors (split on commas), its declarations, and its position in the file.
function topLevelRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let start = 0;
  let i = 0;
  while (i < src.length) {
    if (src[i] !== "{") {
      i++;
      continue;
    }
    const prelude = src.slice(start, i).trim();
    let depth = 0;
    let j = i;
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (!prelude.startsWith("@")) {
      const body = src.slice(i + 1, j);
      const decls = {};
      for (const part of body.split(";")) {
        const k = part.indexOf(":");
        if (k < 0) continue;
        decls[part.slice(0, k).trim()] = part.slice(k + 1).trim();
      }
      for (const sel of prelude.split(",").map((s) => s.trim())) {
        rules.push({ selector: sel, decls, order: rules.length });
      }
    }
    i = j + 1;
    start = i;
  }
  return rules;
}

// Rough specificity: classes, attributes and pseudo-classes. Enough for the simple selectors in this file.
function specificity(sel) {
  return (sel.match(/\.|\[|:(?!:)/g) || []).length;
}

const MODS = [".zero", '[aria-pressed="true"]', ":hover"];

// Every subset of the state modifiers, in the order they appear in MODS, so ".chip.zero[aria-pressed=\"true\"]" is one entry.
function subsetsOf(mods) {
  const out = [];
  for (let mask = 0; mask < 1 << mods.length; mask++) {
    out.push(mods.filter((_, bit) => mask & (1 << bit)));
  }
  return out;
}

// Find every count-text rule ("<base> .n" or "<base>.zero .n") that sets opacity. Returns the base selectors, e.g. ".chip", ".tile".
function countRules(rules) {
  const found = [];
  for (const r of rules) {
    const m = /^(\.[a-z][a-z0-9-]*)((?:\.[a-z][a-z0-9-]*)*)\s+\.n$/.exec(r.selector);
    if (!m) continue;
    const opacity = r.decls.opacity;
    if (opacity === undefined) continue;
    const alpha = Number(opacity);
    if (!Number.isFinite(alpha) || alpha >= 1) continue;
    found.push({ base: m[1], rule: r });
  }
  return found;
}

// Cascade for one property: among the rules whose selector is one of the given selectors, the last one by specificity then file order wins.
function cascade(rules, selectors, prop) {
  const wanted = new Set(selectors);
  const hits = rules
    .filter((r) => wanted.has(r.selector) && r.decls[prop] !== undefined)
    .sort((a, b) => specificity(a.selector) - specificity(b.selector) || a.order - b.order);
  return hits.length ? hits[hits.length - 1].decls[prop] : undefined;
}

function tokenMaps(css) {
  // Same parse as contrast.test.mjs: :root light tokens, dark tokens from the data-theme block (the media block is checked there).
  const body = (re) => {
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
  };
  const toks = (text) => {
    const out = {};
    for (const m of text.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    return out;
  };
  const light = toks(body(/^:root\s*\{/m));
  const darkAttr = toks(body(/^:root\[data-theme="dark"\]\s*\{/m));
  return { light, dark: { ...light, ...darkAttr } };
}

function resolveColor(value, tokens) {
  if (value === undefined) return undefined;
  const v = value.trim();
  const tok = /^var\(--([a-z0-9-]+)\)$/.exec(v);
  if (tok) {
    const hex = tokens[tok[1]];
    if (hex === undefined) throw new Error(`token --${tok[1]} missing`);
    return hex;
  }
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)) return v;
  throw new Error(`unsupported color value: ${v}`);
}

// Evaluate every count text in every chip or tile state. Returns one row per (base, state, theme).
function evaluate(css) {
  const rules = topLevelRules(css);
  const counts = countRules(rules);
  const bases = [...new Set(counts.map((c) => c.base))].sort();
  const maps = tokenMaps(css);
  const rows = [];
  for (const theme of ["light", "dark"]) {
    for (const base of bases) {
      for (const state of subsetsOf(MODS)) {
        const chain = [base, ...state];
        const hostSels = subsetsOf(state).map((sub) => base + sub.join(""));
        const countSels = hostSels.map((s) => s + " .n");
        const bg = resolveColor(cascade(rules, hostSels, "background"), maps[theme]) ??
          resolveColor(cascade(rules, hostSels, "background-color"), maps[theme]);
        const fg = resolveColor(cascade(rules, [...hostSels, ...countSels], "color"), maps[theme]);
        const opacityRaw = cascade(rules, countSels, "opacity");
        const opacity = opacityRaw === undefined ? 1 : Number(opacityRaw);
        const label = `${theme} ${chain.join("")}`;
        if (bg === undefined) throw new Error(`no background for ${base} in ${label}`);
        if (fg === undefined) throw new Error(`no color for ${base} count in ${label}`);
        const shown = blend(fg, bg, opacity);
        rows.push({ theme, base, state: chain.join(""), fg, bg, opacity, shown, ratio: contrast(shown, bg) });
      }
    }
  }
  return rows;
}

const rows = evaluate(CSS);

test("the CSS has count rules for both chips and tiles that set opacity below 1", () => {
  const bases = new Set(countRules(topLevelRules(CSS)).map((c) => c.base));
  assert.ok(bases.has(".chip"), "no '.chip .n' rule with opacity below 1 was found");
  assert.ok(bases.has(".tile"), "no '.tile .n' rule with opacity below 1 was found");
});

for (const theme of ["light", "dark"]) {
  test(`${theme}: chip and tile count text is at least 4.5:1 in every state, including .chip.zero .n`, () => {
    const mine = rows.filter((r) => r.theme === theme);
    assert.ok(mine.some((r) => r.state === ".chip.zero"), "the .chip.zero state was not evaluated");
    const failing = mine.filter((r) => r.ratio < MIN_RATIO);
    const detail = failing
      .map((r) => `${r.state} fg ${r.fg} over bg ${r.bg} at opacity ${r.opacity} = ${r.ratio.toFixed(2)}:1`)
      .join("; ");
    assert.deepEqual(failing.map((r) => r.state), [], `below ${MIN_RATIO}:1 in ${theme}: ${detail}`);
  });
}

test("mutation check: removing the .chip.zero .n override from a copy of the CSS fails the contrast check", () => {
  const mutated = CSS.replace(/\.chip\.zero \.n\s*\{[^}]*\}/, "");
  assert.notEqual(mutated, CSS, "the .chip.zero .n rule was not found to remove");
  const bad = evaluate(mutated).filter((r) => r.ratio < MIN_RATIO && r.state === ".chip.zero");
  assert.ok(bad.length > 0, "removing the override did not produce a failing .chip.zero row");
});
