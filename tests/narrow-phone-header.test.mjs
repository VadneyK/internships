// 2026-10-15 (persona round 11, 360 px budget phone): the home headline broke inside the word ("INTERNSHIP / S") and the
// theme button fell to a second header row. Headings now cap at 9.8vw (wider screens unchanged) and hyphenate at a
// syllable if a word must still break; the brand text is a little smaller on narrow phones, with a rule for 320 px.
// Measured in headless Chrome: one headline line and one header row at 320, 360, 390 and 412 px.
// Run with: node --test tests/narrow-phone-header.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");

test("h1 sizes are capped by the viewport width so the longest word fits", () => {
  assert.match(css, /\nh1 \{ font-size: min\(clamp\(2\.5rem, 9vw, 5\.5rem\), 9\.8vw\); \}/);
  assert.match(css, /\nh1\.display \{ font-size: min\(clamp\(2\.2rem, 7vw, 4rem\), 9\.8vw\); \}/);
  assert.match(css, /\nh1, h2, h3 \{ hyphens: auto; -webkit-hyphens: auto; \}/);
});

test("the phone header keeps brand, Menu and theme on one row down to 320 px", () => {
  assert.match(css, /\.brand \{ gap: \.35rem; font-size: clamp\(\.75rem, 3\.5vw, 1rem\); min-width: 0; \}/);
  assert.match(css, /@media \(max-width: 21rem\) \{ \.top \.brand \{ gap: \.2rem; letter-spacing: -\.01em; \} \.top \.menu-btn \{ padding: 0 \.4rem; \} \}/);
});
