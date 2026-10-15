// 2026-10-15 (persona round 10, low vision in dark mode): the yellow callout keeps dark text in both themes, but its
// muted text read --ink-2, which is light gray in dark mode: 1.22:1 on the yellow. The callout now scopes --ink-2.
// Run with: node --test tests/callout-contrast.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");
function lum(hex) {
  const v = hex.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test("the yellow callout sets its own --ink-2, and it passes 4.5:1 on every yellow the theme defines", () => {
  const m = css.match(/\.callout:not\(\.plain\):not\(\.warn\):not\(\.bad\) \{ --ink-2: (#[0-9a-f]{6}); \}/i);
  assert.ok(m, "scoped --ink-2 on the yellow callout");
  const yellows = [...css.matchAll(/--yellow: (#[0-9a-f]{6});/gi)].map((x) => x[1]);
  assert.ok(yellows.length >= 1);
  for (const y of yellows) assert.ok(ratio(m[1], y) >= 4.5, m[1] + " on " + y + " is " + ratio(m[1], y).toFixed(2));
});

test("more contrast turns the callout's muted text to full ink", () => {
  assert.match(css, /@media \(prefers-contrast: more\) \{ \.callout:not\(\.plain\):not\(\.warn\):not\(\.bad\) \{ --ink-2: #151515; \} \}/);
});
