// Phone header and jump-link targets (ticket r3-teen-flow-1).
// The header is sticky on desktop, but on phones (max-width 40rem) it must scroll away so it does not cover
// the top of the screen. Every jump target also needs a scroll-margin-top so the sticky header does not hide it.
// Reads assets/css/style.css directly, like tests/a11y.dom.test.mjs and tests/contrast.test.mjs do.
// Run with: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// Flatten the stylesheet into rules. Each rule records the @media prelude it sits inside (or null at top level).
function parseRules(css, media = null, out = []) {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    const semi = css.indexOf(";", i);
    if (open === -1) break;
    if (semi !== -1 && semi < open) {
      // A bare statement such as @import or @charset: skip it.
      i = semi + 1;
      continue;
    }
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (prelude.startsWith("@media")) {
      parseRules(body, prelude, out);
    } else {
      out.push({ selector: prelude, body, media });
    }
    i = j;
  }
  return out;
}

const RULES = parseRules(CSS);

// True when a rule's selector list (split on commas) contains the exact selector given.
const selectorsOf = (rule) => rule.selector.split(",").map((s) => s.trim().replace(/\s+/g, " "));

// Read a declaration value such as "position: static" from a rule body. Returns the value or null.
function declaration(body, prop) {
  const m = body.match(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+?)\\s*(?:;|$)`));
  return m ? m[1].trim() : null;
}

test("style.css: the phone (max-width 40rem) block makes .top position static", () => {
  const phoneRules = RULES.filter((r) => r.media && /max-width:\s*40rem/.test(r.media) && selectorsOf(r).includes(".top"));
  assert.ok(phoneRules.length > 0, "no .top rule inside the @media (max-width: 40rem) block");
  const positions = phoneRules.map((r) => declaration(r.body, "position"));
  assert.ok(positions.includes("static"), `expected .top { position: static } on phones, found: ${positions.join(", ") || "none"}`);
});

test("style.css: .top stays sticky on desktop (outside any media query)", () => {
  const desktop = RULES.filter((r) => r.media === null && selectorsOf(r).includes(".top"));
  const positions = desktop.map((r) => declaration(r.body, "position"));
  assert.ok(positions.includes("sticky"), `expected a top-level .top { position: sticky }, found: ${positions.join(", ") || "none"}`);
});

// Convert a CSS length such as "5rem" to rem (px assumed 16 per rem). Returns NaN for anything else.
function toRem(value) {
  const m = /^(-?\d*\.?\d+)(rem|em|px)$/.exec(value || "");
  if (!m) return NaN;
  const n = Number(m[1]);
  return m[2] === "px" ? n / 16 : n;
}

test("style.css: main [id] has a scroll-margin-top of at least 4rem outside any media query", () => {
  const rules = RULES.filter((r) => r.media === null && selectorsOf(r).includes("main [id]"));
  assert.ok(rules.length > 0, "no top-level rule for main [id]");
  const margins = rules.map((r) => declaration(r.body, "scroll-margin-top"));
  const best = Math.max(...margins.map(toRem));
  assert.ok(best >= 4, `expected scroll-margin-top >= 4rem on main [id], found: ${margins.join(", ") || "none"}`);
});

test("style.css: .prog cards also clear the sticky header on jumps", () => {
  const rules = RULES.filter((r) => r.media === null && selectorsOf(r).includes(".prog"));
  const margins = rules.map((r) => declaration(r.body, "scroll-margin-top")).filter(Boolean);
  assert.ok(margins.some((v) => toRem(v) >= 4), `expected a scroll-margin-top >= 4rem on .prog, found: ${margins.join(", ") || "none"}`);
});
