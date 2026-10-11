// Ticket r1-a11y-perf-6: the hero h1 size lives in assets/css/style.css, not in an inline style attribute.
// Every built root page: its h1 has no style attribute that sets font-size, and style.css has a rule
// (h1.display) whose font-size is clamp(2.2rem, 7vw, 4rem). Pages are parsed with JSDOM (no scripts run).
// Run with: node --test tests/a11y-no-inline-h1-size.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
const HERO_SIZE = "clamp(2.2rem,7vw,4rem)";

// Every root .html file (the built pages), in sorted order.
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

function parse(file) {
  return new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;
}

// Rules as [selectorText, declarations] pairs, with comments removed.
function cssRules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean)) !== null) out.push([m[1].trim(), m[2]]);
  return out;
}

test("the page list is not empty", () => {
  assert.ok(PAGES.length >= 20, "expected the built root pages, found " + PAGES.length);
});

test("no built page h1 has an inline style that sets font-size", () => {
  const failing = [];
  for (const file of PAGES) {
    for (const h1 of parse(file).querySelectorAll("h1")) {
      const style = h1.getAttribute("style") || "";
      if (/font-size/i.test(style)) failing.push(`${file}: h1 style="${style}"`);
    }
  }
  assert.deepEqual(failing, [], "inline h1 font-size found:\n" + failing.join("\n"));
});

test("style.css has an h1.display rule with font-size clamp(2.2rem, 7vw, 4rem)", () => {
  const hit = cssRules(CSS).some(([selector, decls]) => {
    const selectors = selector.split(",").map((s) => s.replace(/\s+/g, ""));
    if (!selectors.includes("h1.display")) return false;
    const fontSize = decls.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/);
    return fontSize !== null && fontSize[1].replace(/\s+/g, "") === HERO_SIZE;
  });
  assert.ok(hit, "style.css needs an h1.display rule with font-size: clamp(2.2rem, 7vw, 4rem)");
});
