// 2026-10-15 (persona round 10, low vision, keyboard only, 200% zoom, dark mode): three small CSS fixes.
// Run with: node --test tests/persona-r10-a11y-css.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");

test("checkboxes are at least 24 px (WCAG 2.2 SC 2.5.8 Target Size)", () => {
  assert.match(css, /input\[type="checkbox"\] \{ width: 1\.5rem; height: 1\.5rem;/);
});

test("the home coverage line gets the same paper glow as the lede, so it reads over the splash", () => {
  assert.match(css, /\.hero \.lede, \.hero #coverage \{ text-shadow: 0 0 \.6rem var\(--paper\), 0 0 1\.2rem var\(--paper\); \}/);
  assert.match(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), /id="coverage"/);
});

test("while the fixed Show bar is up, scrolled-to focus stays above it (WCAG 2.2 SC 2.4.11)", () => {
  const at = css.indexOf("@media (max-width: 47.99rem) {\n  .showbar {");
  assert.ok(at > -1);
  const block = css.slice(at, css.indexOf("\n}", at));
  assert.match(block, /html:has\(body\.has-showbar\) \{ scroll-padding-bottom: calc\(5\.5rem \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
});
