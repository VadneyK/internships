// Run with: node --test tests/r1-a11y-perf-1-print-card-btn-addresses.test.mjs
// Paper cannot click, so a printed page must say where each external button goes. The general print rule in
// style.css skips .btn links. The Languages cards ("Open the official page") and the Calendar cards ("Official page")
// are .btn links inside a plain .card, so a print rule for .card a.btn[href^="http"] prints their addresses.
// Internal "Details" links (find.html#p-...) and the GitHub buttons on contribute.html need not match.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

const RULE_SELECTOR = '.card a.btn[href^="http"]:not(.noprint)::after';
// The same selector without the pseudo-element, for element.matches in jsdom.
const ELEMENT_SELECTOR = RULE_SELECTOR.replace(/::after$/, "");

// Returns the text between the "{" at openIdx and its matching "}".
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

// The body of every @media print block in the stylesheet.
function printBodies(css) {
  const out = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) out.push(braceBody(css, m.index + m[0].length - 1));
  return out;
}

// Every selector in a print block that prints an address after a .btn link (ends in ::after, names a.btn).
function printButtonSelectors(css) {
  const sels = [];
  for (const body of printBodies(css)) {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(body))) {
      for (const s of m[1].split(",").map((x) => x.trim())) {
        if (/::after$/.test(s) && /a\.btn/.test(s) && /attr\(href\)/.test(m[2])) sels.push(s);
      }
    }
  }
  return sels;
}

// Returns the declarations of the print rule whose selector list includes RULE_SELECTOR, or null.
function cardRule(css) {
  for (const body of printBodies(css)) {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(body))) {
      if (m[1].split(",").map((x) => x.trim()).includes(RULE_SELECTOR)) return m[2];
    }
  }
  return null;
}

// Loads a page and waits for its lists to finish loading, as the other print tests do.
async function loadWithLists(file, opts = {}) {
  const page = await loadPage(file, opts);
  for (let i = 0; i < 80 && /Loading/.test(page.document.getElementById("count")?.textContent || ""); i++) await tick(25);
  return page;
}

// Checks every external .btn in main (not .noprint) matches one of the print selectors.
function unmatchedButtons(document, selectors) {
  const bad = [];
  for (const a of document.querySelectorAll('main a.btn[href^="http"]:not(.noprint)')) {
    const hit = selectors.some((s) => {
      try {
        return a.matches(s.replace(/::after$/, ""));
      } catch {
        return false;
      }
    });
    if (!hit) bad.push(`${a.textContent.trim().slice(0, 40)} -> ${a.getAttribute("href")}`);
  }
  return bad;
}

test("card buttons: the print block has a rule for .card external .btn links that prints attr(href) in parentheses", () => {
  const decls = cardRule(CSS);
  assert.ok(decls, `no print rule whose selector list includes ${RULE_SELECTOR}`);
  assert.match(decls, /content:\s*"\s*\(\s*"\s*attr\(href\)\s*"\s*\)"/, "rule must print the address with attr(href) in parentheses");
});

test("card buttons: the general address rule still skips .btn links and the program card rule is unchanged", () => {
  const general = 'main a[href^="http"]:not(.btn):not(.noprint)::after';
  const prog = '.prog a.btn[href^="http"]:not(.noprint)::after';
  const bodies = printBodies(CSS);
  assert.ok(bodies.some((b) => b.includes(general)), "general address rule for links in main is missing or changed");
  assert.ok(bodies.some((b) => b.includes(prog)), "program card address rule is missing");
});

test("card buttons: languages.html, default filters, every external main .btn that is not .noprint is matched by a print rule", async () => {
  const { document, errors } = await loadWithLists("languages.html");
  assert.deepEqual(errors, []);
  const buttons = document.querySelectorAll('main a.btn[href^="http"]:not(.noprint)');
  assert.ok(buttons.length > 0, "languages.html should show external official page buttons");
  const selectors = printButtonSelectors(CSS);
  assert.deepEqual(unmatchedButtons(document, selectors), []);
  for (const a of buttons) assert.ok(a.closest(".card"), "each languages button should sit in a .card");
});

test("card buttons: calendar.html, February (m=2 has a program with a link), every external main .btn that is not .noprint is matched", async () => {
  const { document, errors } = await loadWithLists("calendar.html", { search: "?m=2" });
  await tick(200);
  assert.deepEqual(errors, []);
  const buttons = document.querySelectorAll('main a.btn[href^="http"]:not(.noprint)');
  assert.ok(buttons.length > 0, "calendar.html for month 2 should show an external official page button");
  const selectors = printButtonSelectors(CSS);
  assert.deepEqual(unmatchedButtons(document, selectors), []);
});

test("card buttons: the card selector does not match the internal Details links on calendar.html", async () => {
  const cal = await loadWithLists("calendar.html", { search: "?m=2" });
  await tick(200);
  const details = [...cal.document.querySelectorAll("main a.btn")].filter((a) => /^find\.html#p-/.test(a.getAttribute("href") || ""));
  assert.ok(details.length > 0, "calendar.html should show Details links");
  for (const a of details) assert.equal(a.matches(ELEMENT_SELECTOR), false, "internal Details link should not be matched");
});
