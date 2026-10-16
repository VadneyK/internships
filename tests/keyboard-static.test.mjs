// 2026-10-15 (overnight keyboard sweep): rules a keyboard user depends on, checked over every built page and the stylesheet.
// No positive tabindex (it breaks the natural order), no autofocus (it moves the reader on load), no link or button inside
// another (two tab stops for one thing), a visible focus ring for every element, and only one deliberate outline removal.
// Run with: node --test tests/keyboard-static.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const ROOT = new URL("../", import.meta.url);
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const css = fs.readFileSync(new URL("assets/css/style.css", ROOT), "utf8");

test("no built page has a positive tabindex, autofocus, or a link or button nested in another", () => {
  assert.ok(pages.length > 15);
  for (const f of pages) {
    const d = new JSDOM(fs.readFileSync(new URL(f, ROOT), "utf8")).window.document;
    for (const el of d.querySelectorAll("[tabindex]")) assert.ok(Number(el.getAttribute("tabindex")) <= 0, f + ": tabindex " + el.getAttribute("tabindex") + " on " + el.tagName);
    assert.equal(d.querySelectorAll("[autofocus]").length, 0, f + ": autofocus");
    assert.equal(d.querySelectorAll("a[href] a[href], a[href] button, button a[href], button button").length, 0, f + ": nested interactive elements");
  }
});

test("every element gets a visible focus ring, and the only outline removal is the skip target #main", () => {
  assert.match(css, /:focus-visible \{ outline: 3px solid var\(--focus\); outline-offset: 3px; \}/);
  const removals = [...css.matchAll(/([^{}]+)\{[^}]*outline:\s*(?:none|0)\b[^}]*\}/g)].map((m) => m[1].replace(/\/\*[^]*?\*\//g, "").trim());
  assert.deepEqual(removals, ["#main:focus"]);
});
