// Run with: node --test tests/r1-a11y-perf-1-print-nav.test.mjs
// Paper cannot be clicked, so the jump chips ("On this page", "Jump to", "Next steps") and the breadcrumbs
// must not print. The check reads the print rules in assets/css/style.css (comments removed) and then loads
// every built root page to make sure each chip row or breadcrumb inside <main> is hidden by a print rule.
// The inline chip rows inside .filters and the filter chips on find.html are not nav elements and stay on paper.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
// Comments removed so their text never reads as a selector or a declaration.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

// Text between the "{" at openIdx and its matching "}".
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

// Bodies of every @media print block in the stylesheet.
function printBlocks(css) {
  const out = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) out.push(braceBody(css, m.index + m[0].length - 1));
  assert.ok(out.length >= 1, "no @media print block found in style.css");
  return out;
}

// Flat rules inside a print block (the print blocks hold no nested braces).
function rulesIn(body) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(body))) {
    const decls = {};
    for (const part of m[2].split(";")) {
      const idx = part.indexOf(":");
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim();
      if (prop) decls[prop] = part.slice(idx + 1).trim();
    }
    const selectors = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    rules.push({ selectors, decls, body: m[2] });
  }
  return rules;
}

const PRINT_RULES = printBlocks(CSS).flatMap((body) => rulesIn(body));

// Selectors that a print rule sets to display: none !important.
function hiddenOnPaper() {
  const set = new Set();
  for (const r of PRINT_RULES) {
    const raw = r.decls.display || "";
    const important = /!\s*important\s*$/i.test(raw);
    const value = raw.replace(/\s*!\s*important\s*$/i, "").trim();
    if (value === "none" && important) r.selectors.forEach((s) => set.add(s));
  }
  return set;
}

const HIDDEN = hiddenOnPaper();

// Selector must be scoped to a nav element: "nav.chips" or "nav.breadcrumb", optionally inside "main".
const NAV_SCOPED = /^(main\s+)?nav\.(chips|breadcrumb)$/;

test("print: the print rule hides nav.chips and nav.breadcrumb with display: none !important", () => {
  assert.ok(HIDDEN.has("main nav.chips") || HIDDEN.has("nav.chips"), "no print rule hides nav.chips");
  assert.ok(HIDDEN.has("main nav.breadcrumb") || HIDDEN.has("nav.breadcrumb"), "no print rule hides nav.breadcrumb");
});

test("print: every selector that hides chips or breadcrumbs is scoped to a nav element", () => {
  for (const s of HIDDEN) {
    if (/chips|breadcrumb/.test(s)) {
      assert.match(s, NAV_SCOPED, `chip or breadcrumb print selector must target a nav element: "${s}"`);
    }
  }
});

test("print: no rule hides plain .chips or .breadcrumb outside nav, so filter chips still print", () => {
  for (const s of HIDDEN) {
    assert.ok(!/^\.(chips|breadcrumb)$/.test(s), `print hides "${s}" outside a nav element`);
    assert.ok(!/#typeChips|#paidChips|#hubChips|#fieldChips|#relatedLinks/.test(s), `print hides filter chips via "${s}"`);
  }
});

// Every root page, loaded statically (scripts are not run).
const PAGES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort();

test("print: every built root page has its chip rows and breadcrumbs hidden on paper", () => {
  assert.ok(PAGES.length >= 20, `expected the built root pages, found ${PAGES.length}`);
  const problems = [];
  let navCount = 0;
  for (const file of PAGES) {
    const dom = new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8"));
    const doc = dom.window.document;
    const main = doc.querySelector("main");
    if (!main) continue;
    for (const nav of main.querySelectorAll("nav.chips, nav.breadcrumb")) {
      navCount++;
      if (nav.classList.contains("noprint")) continue;
      const hiddenBy = [...HIDDEN].find((sel) => {
        try {
          return nav.matches(sel);
        } catch {
          return false;
        }
      });
      if (!hiddenBy) problems.push(`${file}: <nav class="${nav.className}" aria-label="${nav.getAttribute("aria-label") || ""}"> is not hidden on paper`);
    }
    // Chip rows that are not nav elements (inside .filters, find.html type chips) must not be hidden.
    for (const div of main.querySelectorAll(".chips")) {
      if (div.tagName === "NAV" || div.classList.contains("noprint")) continue;
      for (const sel of HIDDEN) {
        let hit = false;
        try {
          hit = div.matches(sel);
        } catch {
          hit = false;
        }
        if (hit) problems.push(`${file}: non-nav .chips div (id="${div.id}") is hidden by "${sel}"`);
      }
    }
  }
  assert.ok(navCount > 0, "no chip or breadcrumb nav found in any built page");
  assert.deepEqual(problems, [], "print leaves chip or breadcrumb nav visible:\n" + problems.join("\n"));
});

test("print: find.html type chips and the filters chip rows are not nav elements", () => {
  const doc = new JSDOM(fs.readFileSync(path.join(ROOT, "find.html"), "utf8")).window.document;
  for (const id of ["typeChips", "paidChips", "hubChips", "fieldChips"]) {
    const el = doc.getElementById(id);
    assert.ok(el, `find.html is missing #${id}`);
    assert.notEqual(el.tagName, "NAV", `#${id} must stay a div so it prints`);
  }
});
