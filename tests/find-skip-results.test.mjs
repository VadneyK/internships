// 2026-10-15 (persona round 10, keyboard only at 200% zoom): on find.html the only jump to the results came after about 90
// filter stops. A skip link now sits first in main, shows only when focused, and lands on the result count.
// WCAG 2.2 SC 2.4.1 Bypass Blocks. Run with: node --test tests/find-skip-results.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

test("the skip link is the first focusable thing in main and targets the focusable count", async () => {
  const { document } = await loadPage("find.html");
  await tick(50);
  const main = document.getElementById("main");
  const first = [...main.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")].find((e) => e.tabIndex >= 0 && !e.disabled);
  assert.equal(first.className, "skip-here noprint");
  assert.equal(first.getAttribute("href"), "#count");
  assert.equal(first.textContent, "Skip the filters, go to the results");
  assert.equal(document.getElementById("count").getAttribute("tabindex"), "-1");
  assert.ok(first.compareDocumentPosition(document.getElementById("filters")) & 4, "it comes before the filters");
});

test("the skip link is off screen until focused, then shows in place", () => {
  const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");
  assert.match(css, /\.skip-here \{ position: absolute; left: -999px; \}/);
  assert.match(css, /\.skip-here:focus \{ position: static; display: inline-block;/);
});
