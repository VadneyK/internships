// Ticket r3-a11y-perf-26: the sticky header must not cover a short landscape screen.
// The header only sticks when the screen is at least 64rem wide (40.0625rem until 2026-10-16, see r12-a11y-perf-1) AND 34rem tall. Short screens (a phone held sideways)
// keep the header static, and the scroll offsets match the wrapped header (about 8rem) inside that same min-height block.
// Reads style.css as text (comments stripped), using the same helpers as tests/a11y-scroll-padding.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = stripComments(fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8"));

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Every @media block in the sheet, with its query text and its body (brace matched).
function mediaBlocks(css) {
  const out = [];
  const re = /@media\s*([^{]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out.push({ query: m[1].trim(), body: css.slice(re.lastIndex, i - 1) });
  }
  return out;
}

// The stylesheet with every @media block (brace matched) removed.
function outsideMedia(css) {
  let out = "";
  let i = 0;
  const re = /@media\s*[^{]+\{/g;
  let m;
  while ((m = re.exec(css))) {
    out += css.slice(i, m.index);
    let depth = 1;
    let j = re.lastIndex;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    i = j;
    re.lastIndex = j;
  }
  return out + css.slice(i);
}

// Every plain rule (selector and body) that sits outside any @media block, in order.
function topLevelRules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  const stripped = outsideMedia(css);
  while ((m = re.exec(stripped))) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith("@")) continue;
    out.push({ selector: sel, body: m[2] });
  }
  return out;
}

// The value of one declaration in a rule body, or null.
function declaration(body, prop) {
  const m = new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+?)\\s*(?:;|$)`).exec(body);
  return m ? m[1].trim() : null;
}

function minRem(query, feature) {
  const m = new RegExp(`\\(\\s*${feature}:\\s*([\\d.]+)rem\\s*\\)`).exec(query);
  return m ? parseFloat(m[1]) : null;
}

// True when the query has both a min-width and a min-height condition (the short-screen guard).
function isMinWidthMinHeight(query) {
  return /min-width/.test(query) && /min-height/.test(query);
}

// Every "position: sticky" that targets .top, paired with the @media query it sits inside (or null).
function stickyTopContexts(css) {
  const found = [];
  for (const r of topLevelRules(css)) {
    if (r.selector.split(",").map((s) => s.trim()).includes(".top") && /position:\s*sticky/.test(r.body)) {
      found.push(null);
    }
  }
  for (const b of mediaBlocks(css)) {
    for (const r of topLevelRules(b.body)) {
      if (r.selector.split(",").map((s) => s.trim()).includes(".top") && /position:\s*sticky/.test(r.body)) {
        found.push(b.query);
      }
    }
  }
  return found;
}

// The short-screen guard is valid when every sticky .top sits in a min-width + min-height block.
function stickyOnlyWhenTall(css) {
  return stickyTopContexts(css).every((q) => q !== null && isMinWidthMinHeight(q));
}

// The offsets inside the min-width + min-height block: html scroll-padding-top and main [id] / .prog scroll-margin-top.
function tallBlockOffsets(css) {
  const blocks = mediaBlocks(css).filter((b) => isMinWidthMinHeight(b.query) && minRem(b.query, "min-width") >= 40);
  let padding = null;
  let margin = null;
  for (const b of blocks) {
    for (const r of topLevelRules(b.body)) {
      const sel = r.selector.split(",").map((s) => s.trim());
      if (sel.includes("html")) {
        const v = declaration(r.body, "scroll-padding-top");
        if (v) padding = parseFloat(v);
      }
      if (sel.includes("main [id]") || sel.includes(".prog")) {
        const v = declaration(r.body, "scroll-margin-top");
        if (v) margin = parseFloat(v);
      }
    }
  }
  return { padding, margin };
}

// Base .top rule is static, outside any media query.
function baseTopPosition(css) {
  const rules = topLevelRules(css).filter((r) => r.selector.split(",").map((s) => s.trim()).includes(".top"));
  return rules.map((r) => declaration(r.body, "position"));
}

test("the sticky header only applies inside a min-width and min-height media block", () => {
  assert.ok(stickyTopContexts(CSS).length > 0, "expected a .top { position: sticky } rule");
  assert.ok(stickyOnlyWhenTall(CSS), "every .top { position: sticky } must sit in a @media block with both min-width and min-height");
});

test("the base .top rule is position: static", () => {
  const positions = baseTopPosition(CSS);
  assert.ok(positions.includes("static"), `expected a top-level .top { position: static }, found: ${positions.join(", ") || "none"}`);
  assert.ok(!positions.includes("sticky"), "the top-level .top rule must not be sticky");
});

test("the 40rem and under block keeps the header static", () => {
  const small = mediaBlocks(CSS).filter((b) => /max-width:\s*40rem/.test(b.query));
  assert.ok(small.some((b) => /\.top\s*\{\s*position:\s*static/.test(b.body)), "max-width: 40rem block must set .top { position: static }");
});

test("the scroll padding and jump offsets are at least the wrapped header height (8rem) in the tall block", () => {
  const { padding, margin } = tallBlockOffsets(CSS);
  assert.ok(padding !== null && padding >= 8, `html scroll-padding-top in the min-height block must be >= 8rem, found: ${padding}`);
  assert.ok(margin !== null && margin >= 8, `main [id] / .prog scroll-margin-top in the min-height block must be >= 8rem, found: ${margin}`);
});

test("the existing jump-link scroll margin and desktop scroll padding rules are still present", () => {
  assert.match(CSS, /main \[id\], \.prog\s*\{\s*scroll-margin-top:\s*5rem;?\s*\}/);
  assert.match(CSS, /@media \(min-width: 40\.0625rem\) \{ html \{ scroll-padding-top: 5rem; \} \}/);
});

test("mutation: a sticky .top outside the min-height block fails the check", () => {
  const mutated = CSS.replace(/\.top \{ position: static;/, ".top { position: sticky;");
  assert.equal(stickyOnlyWhenTall(mutated), false);
});

test("mutation: a sticky .top in a width-only media block fails the check", () => {
  const mutated = CSS.replace(
    "@media (min-width: 64rem) and (min-height: 34rem) {",
    "@media (min-width: 64rem) {",
  );
  assert.equal(stickyOnlyWhenTall(mutated), false);
});

test("mutation: a 5rem offset inside the tall block fails the check", () => {
  const mutated = CSS.replace(/html \{ scroll-padding-top: 8rem; \}/, "html { scroll-padding-top: 5rem; }");
  const { padding } = tallBlockOffsets(mutated);
  assert.equal(padding >= 8, false);
});
