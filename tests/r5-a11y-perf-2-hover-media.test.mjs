// Run with: node --test tests/r5-a11y-perf-2-hover-media.test.mjs
// Ticket r2-a11y-perf-2: hover styles only apply on devices that can hover.
// On a phone the hover state sticks after a tap, so every bare :hover rule in assets/css/style.css must sit inside
// @media (hover: hover). The print and forced-colors blocks are exempt. Press feedback (:active) must not be gated,
// because touch screens still need it.
// Reads the CSS from disk. No network, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// Walks every style rule and records the at-rule blocks that enclose it (outermost first).
function collectRules(src, ancestors, out) {
  let start = 0;
  let i = 0;
  while (i < src.length) {
    if (src[i] !== "{") { i++; continue; }
    // A prelude can follow a statement such as "@import ...;", so keep only the text after the last ";".
    const prelude = src.slice(start, i).split(";").pop().replace(/\s+/g, " ").trim();
    let depth = 0;
    let j = i;
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}" && --depth === 0) break;
    }
    const body = src.slice(i + 1, j);
    if (prelude.startsWith("@")) {
      collectRules(body, [...ancestors, prelude], out);
    } else {
      for (const sel of prelude.split(",").map((s) => s.trim()).filter(Boolean)) {
        out.push({ selector: sel, ancestors });
      }
    }
    i = j + 1;
    start = i;
  }
  return out;
}

const RULES = collectRules(CSS, [], []);
const HOVER_MEDIA = /^@media\s*\(hover:\s*hover\)$/;
const EXEMPT_MEDIA = /^@media\s*(print\b|\(forced-colors:\s*active\))/;
const inHoverMedia = (rule) => rule.ancestors.some((a) => HOVER_MEDIA.test(a));
const isExempt = (rule) => rule.ancestors.some((a) => EXEMPT_MEDIA.test(a));
const hoverRules = RULES.filter((r) => r.selector.includes(":hover"));
const activeRules = RULES.filter((r) => r.selector.includes(":active"));

test("the parser finds the hover rules it is meant to check", () => {
  assert.ok(hoverRules.length >= 12, `expected at least 12 :hover rules, found ${hoverRules.length}`);
});

test("every :hover rule sits inside @media (hover: hover), print and forced-colors excepted", () => {
  const bad = hoverRules
    .filter((r) => !isExempt(r) && !inHoverMedia(r))
    .map((r) => r.selector);
  assert.deepEqual(bad, []);
});

test("the .btn:disabled hover reset is inside the hover block", () => {
  for (const sel of [".btn:disabled:hover", ".btn[disabled]:hover"]) {
    const rule = RULES.find((r) => r.selector === sel);
    assert.ok(rule, `no rule for ${sel}`);
    assert.ok(inHoverMedia(rule), `${sel} is not inside @media (hover: hover)`);
  }
});

test("no :active rule is gated by hover, so press feedback still works on touch", () => {
  assert.ok(activeRules.length > 0, "expected at least one :active rule");
  const gated = activeRules.filter((r) => inHoverMedia(r)).map((r) => r.selector);
  assert.deepEqual(gated, []);
});

test("the button press rules stay at top level", () => {
  for (const sel of [".btn:active", ".btn:disabled:active", ".btn[disabled]:active"]) {
    const rule = RULES.find((r) => r.selector === sel);
    assert.ok(rule, `no rule for ${sel}`);
    assert.equal(rule.ancestors.length, 0, `${sel} should not sit inside any at-rule`);
  }
});
