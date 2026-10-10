// Skip link focus (ticket r2-a11y-perf-3): "Skip to content" must move focus into <main>, so the next Tab goes into the page, not back into the header nav.
// Static checks parse every built root page with JSDOM. Behavior checks load real pages with their scripts (dom-helper.mjs).
// Run with: node --test tests/r2-a11y-perf-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Same page list as the other a11y tests: built pages in the repo root only.
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

const parsedCache = new Map();
function staticDoc(file) {
  if (!parsedCache.has(file)) {
    parsedCache.set(file, new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document);
  }
  return parsedCache.get(file);
}

const FOCUSABLE = "a[href], area[href], button, input:not([type=hidden]), select, textarea, iframe, summary, [contenteditable], [tabindex]";

// An element takes part in Tab order unless it is disabled or has a negative tabindex (for example the main target, tabindex -1).
function inTabOrder(el) {
  if (el.hasAttribute("disabled")) return false;
  const ti = el.getAttribute("tabindex");
  return ti === null || Number(ti) >= 0;
}

test("the page list has the built pages in the repo root", () => {
  assert.ok(PAGES.includes("index.html"), "index.html missing from the page list");
  assert.ok(PAGES.length >= 18, `expected at least 18 built pages, found ${PAGES.length}`);
});

// ---------- acceptance 1: one <main id="main"> with tabindex -1 on every built page ----------

for (const file of PAGES) {
  test(`${file}: exactly one <main id="main"> and it has tabindex="-1"`, () => {
    const doc = staticDoc(file);
    const mains = doc.querySelectorAll("main");
    assert.equal(mains.length, 1, `found ${mains.length} <main> elements`);
    assert.equal(mains[0].id, "main");
    assert.equal(mains[0].getAttribute("tabindex"), "-1");
  });
}

// ---------- acceptance 2: the skip link is the first tab stop, and it points at #main ----------

for (const file of PAGES) {
  test(`${file}: the first focusable element in the body is a.skip with href="#main"`, () => {
    const doc = staticDoc(file);
    const first = [...doc.body.querySelectorAll(FOCUSABLE)].find(inTabOrder);
    assert.ok(first, "no focusable element in the body");
    assert.equal(first.tagName, "A", `first focusable is <${first.tagName.toLowerCase()}>`);
    assert.ok(first.classList.contains("skip"), `first focusable is not a.skip: ${first.outerHTML.slice(0, 90)}`);
    assert.equal(first.getAttribute("href"), "#main");
    assert.equal(doc.querySelector(first.getAttribute("href")), doc.getElementById("main"));
  });
}

// ---------- acceptance 3: the focus target shows no ring ----------

test("style.css: #main:focus (or main:focus) sets outline to none or 0", () => {
  const raw = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
  // Drop comments first so their commas and braces do not confuse the rule split.
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].split(",").map((s) => s.trim()),
    body: m[2],
  }));
  const focusRules = rules.filter((r) => r.selectors.some((s) => s === "#main:focus" || s === "main:focus"));
  assert.ok(focusRules.length > 0, "no #main:focus or main:focus rule in style.css");
  assert.ok(
    focusRules.some((r) => /outline\s*:\s*(none|0)\s*(;|$)/.test(r.body)),
    "the main:focus rule does not set outline to none or 0"
  );
});

// ---------- acceptance 4: focusing #main in a loaded page moves focus into <main> ----------

for (const file of ["index.html", "find.html", "paycheck.html"]) {
  test(`${file}: document.getElementById('main').focus() makes <main> the active element`, async () => {
    const { document } = await loadPage(file);
    await tick(100);
    const main = document.getElementById("main");
    main.focus();
    assert.equal(document.activeElement, main);
  });
}
