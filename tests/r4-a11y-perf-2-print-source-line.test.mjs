// Run with: node --test tests/r4-a11y-perf-2-print-source-line.test.mjs
// A printed sheet must say where its numbers came from. Every built root page (all but 404) carries one
// <p class="printonly print-source"> directly under body, outside <main>, with the page's own canonical URL
// and the "Last checked" date from the footer. It is aria-hidden so a screen reader does not hear it twice.
// The CSS check reads assets/css/style.css (comments removed): .print-source is display:none outside
// @media print, display:block inside it, and the body.print-one rule still hides it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://vadneyk.github.io/internships/";
const RAW_CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
const CSS = RAW_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function braceBody(css, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(openIdx + 1, i);
    }
  }
  throw new Error("unclosed block in style.css");
}

// Bodies of every @media print block, and the CSS with those blocks removed.
function splitPrint(css) {
  const bodies = [];
  let outside = css;
  const re = /@media\s+print\s*\{/g;
  let m;
  const spans = [];
  while ((m = re.exec(css))) {
    const open = m.index + m[0].length - 1;
    const body = braceBody(css, open);
    bodies.push(body);
    spans.push([m.index, open + body.length + 2]);
  }
  assert.ok(bodies.length >= 1, "no @media print block found in style.css");
  for (const [a, b] of spans.reverse()) outside = outside.slice(0, a) + outside.slice(b);
  return { bodies, outside };
}

// Flat rules: selectors plus declarations. Blocks such as @media keep their inner rules as flat rules.
function rulesIn(text) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const decls = {};
    for (const part of m[2].split(";")) {
      const idx = part.indexOf(":");
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim();
      if (prop) decls[prop] = part.slice(idx + 1).trim();
    }
    rules.push({ selectors: m[1].split(",").map((s) => s.trim()).filter(Boolean), decls });
  }
  return rules;
}

function displayFor(rules, selector) {
  let value;
  for (const r of rules) {
    if (r.selectors.includes(selector) && r.decls.display !== undefined) value = r.decls.display.replace(/\s*!important\s*$/, "");
  }
  return value;
}

const { bodies: PRINT_BODIES, outside: OUTSIDE_PRINT } = splitPrint(CSS);
const PRINT_RULES = PRINT_BODIES.flatMap((b) => rulesIn(b));
const SCREEN_RULES = rulesIn(OUTSIDE_PRINT);

const PAGES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html") && f !== "404.html")
  .sort();

test("style.css: .print-source is hidden on screen and shown on paper", () => {
  assert.equal(displayFor(SCREEN_RULES, ".print-source"), "none", ".print-source must be display:none outside @media print");
  assert.equal(displayFor(PRINT_RULES, ".print-source"), "block", ".print-source must be display:block inside @media print");
});

test("style.css: body.print-one still hides the source line in print", () => {
  const rule = PRINT_RULES.find((r) => r.selectors.includes("body.print-one > *:not(#printRoot)"));
  assert.ok(rule, "the body.print-one rule must exist in @media print");
  assert.equal(rule.decls.display.replace(/\s*!important\s*$/, ""), "none");
});

test("built root pages: one print source line with the canonical URL and the footer date", () => {
  assert.ok(PAGES.includes("index.html") && PAGES.includes("permit.html"), "expected built root pages");
  for (const file of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const lines = doc.body.querySelectorAll("p.printonly.print-source");
    assert.equal(lines.length, 1, `${file}: expected exactly one p.printonly.print-source`);
    const line = lines[0];
    assert.equal(line.parentElement, doc.body, `${file}: the source line must sit directly under body`);
    assert.equal(line.closest("main"), null, `${file}: the source line must be outside main`);
    assert.equal(line.getAttribute("aria-hidden"), "true", `${file}: the source line must be aria-hidden`);

    const canonical = doc.querySelector('link[rel="canonical"]').getAttribute("href");
    const pageUrl = BASE + (file === "index.html" ? "" : file);
    assert.equal(canonical, pageUrl, `${file}: canonical URL differs from the expected page URL`);
    const text = line.textContent;
    assert.ok(text.includes(pageUrl), `${file}: source line must contain ${pageUrl}`);

    const checkedEl = doc.querySelector("footer.foot p.small b");
    assert.ok(checkedEl && checkedEl.parentElement.textContent.includes("Last checked"), `${file}: footer date missing`);
    const checked = checkedEl.textContent.trim();
    assert.ok(checked.length > 0, `${file}: footer date is empty`);
    assert.ok(text.includes(checked), `${file}: source line must contain the footer date "${checked}"`);

    assert.ok(!/[\u2013\u2014]/.test(text), `${file}: source line has an en or em dash`);
  }
});
