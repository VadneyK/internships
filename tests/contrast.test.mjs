// Run with: node --test tests/contrast.test.mjs
// Locks in the color contrast of every text and tag token pair in assets/css/style.css, in light and dark mode.
// Reads the CSS and the source pages from disk. No network, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");

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

// Returns the text between the { and the matching } of the first rule that matches re.
// The regex must end with a literal "{" so the match tells us where the block opens.
function ruleBody(css, re) {
  const m = re.exec(css);
  assert.ok(m, `rule not found: ${re}`);
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

function customProps(body) {
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const mediaBody = ruleBody(CSS, /@media \(prefers-color-scheme: dark\)\s*\{/);
const light = customProps(ruleBody(CSS, /^:root\s*\{/m));
const darkMedia = customProps(ruleBody(mediaBody, /:root:not\(\[data-theme="light"\]\)\s*\{/));
const darkAttr = customProps(ruleBody(CSS, /^:root\[data-theme="dark"\]\s*\{/m));
const dark = { ...light, ...darkAttr };
const THEMES = { light, dark };

function color(theme, name) {
  const v = THEMES[theme][name];
  assert.ok(v !== undefined, `token --${name} missing in ${theme} theme`);
  assert.match(v, /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, `--${name} is not a hex color in ${theme}: ${v}`);
  return v;
}

const TEXT_PAIRS = [
  ["ink", "paper"],
  ["ink", "surface"],
  ["ink-2", "paper"],
  ["ink-2", "paper-2"],
  ["ink-2", "surface"],
  ["orange-text", "paper"],
  ["orange-text", "surface"],
  ["orange-text", "paper-2"],
  ["on-orange", "orange"],
  ["tag-fg", "tag-bg"],
  ["good", "good-bg"],
  ["warn", "warn-bg"],
  ["bad", "bad-bg"],
  ["focus", "paper"],
  ["focus", "surface"],
];

for (const theme of ["light", "dark"]) {
  for (const [fg, bg] of TEXT_PAIRS) {
    test(`${theme}: --${fg} on --${bg} is at least 4.5:1`, () => {
      const r = contrast(color(theme, fg), color(theme, bg));
      assert.ok(r >= 4.5, `${fg} on ${bg} in ${theme} is ${r.toFixed(2)}:1`);
    });
  }
  // Near-miss pair: passes 3:1 for large heading text only. The "orange class" test below keeps it in headings.
  test(`${theme}: --orange-display on --paper is at least 3:1 (large text only)`, () => {
    const r = contrast(color(theme, "orange-display"), color(theme, "paper"));
    assert.ok(r >= 3, `orange-display on paper in ${theme} is ${r.toFixed(2)}:1`);
  });
}

test("the prefers-color-scheme dark block and the data-theme=dark block define identical tokens", () => {
  assert.deepEqual(darkMedia, darkAttr);
  assert.ok(Object.keys(darkAttr).length > 10, "dark token block parsed too few tokens");
});

test("the orange class is only used inside h1, h2, h3 or .lede in src pages", () => {
  const dir = path.join(ROOT, "src");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html"));
  let inside = 0;
  const bad = [];
  for (const f of files) {
    const doc = new JSDOM(fs.readFileSync(path.join(dir, f), "utf8")).window.document;
    for (const el of doc.querySelectorAll(".orange")) {
      if (el.closest("h1, h2, h3, .lede")) inside++;
      else bad.push(`${f}: ${el.outerHTML.slice(0, 90)}`);
    }
  }
  assert.ok(inside > 0, "expected some orange spans inside headings (parse check)");
  assert.deepEqual(bad, []);
});
