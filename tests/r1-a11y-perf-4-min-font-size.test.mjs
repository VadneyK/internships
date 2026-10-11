// Run with: node --test tests/r1-a11y-perf-4-min-font-size.test.mjs
// Ticket r1-a11y-perf-4: no screen font-size in assets/css/style.css may be below 12 px (.75rem).
// Reads the CSS from disk. No network, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");

const MIN_PX = 12;
const PX_PER_REM = 16;

// Remove /* ... */ comments.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Remove every @media print block, including nested braces.
function stripPrintMedia(css) {
  let out = css;
  let idx;
  while ((idx = out.search(/@media\s+print\b[^{]*\{/)) !== -1) {
    const open = out.indexOf("{", idx);
    let depth = 0;
    let end = out.length;
    for (let i = open; i < out.length; i++) {
      if (out[i] === "{") depth++;
      else if (out[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    out = out.slice(0, idx) + out.slice(end);
  }
  return out;
}

// Yield { selector, value } for each innermost rule body (no nested braces inside).
function* rules(css) {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, " ");
    const body = m[2];
    for (const d of body.matchAll(/(?:^|;)\s*font-size\s*:\s*([^;]+)/g)) {
      yield { selector, value: d[1].trim() };
    }
  }
}

// Convert a font-size value given in rem or px to pixels. Returns null for other units
// (em, %, keywords, var()). For clamp(min, ...) the first argument is the smallest size.
function toPixels(value) {
  const inner = value.startsWith("clamp(") ? value.slice(6).split(",")[0] : value;
  const m = /^\s*(\d*\.?\d+)(rem|px)\s*$/.exec(inner);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === "rem" ? n * PX_PER_REM : n;
}

const screenCss = stripPrintMedia(stripComments(CSS));
const found = [...rules(screenCss)];
const checked = found.map((r) => ({ ...r, px: toPixels(r.value) })).filter((r) => r.px !== null);

test("style.css has screen font-size declarations to check", () => {
  assert.ok(checked.length > 20, `expected many rem or px font-size rules, found ${checked.length}`);
});

test("every screen font-size in style.css is at least 12 px (.75rem)", (t) => {
  const selectors = [...new Set(checked.map((r) => `${r.selector} { font-size: ${r.value} }`))];
  t.diagnostic(`checked ${checked.length} font-size declarations across ${selectors.length} rules`);
  const small = checked.filter((r) => r.px < MIN_PX);
  const detail = small.map((r) => `${r.selector} { font-size: ${r.value} } = ${r.px}px`).join("\n  ");
  assert.equal(
    small.length,
    0,
    `font-size below ${MIN_PX}px in these rules:\n  ${detail}`
  );
});
