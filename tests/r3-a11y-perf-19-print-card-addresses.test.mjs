// Run with: node --test tests/r3-a11y-perf-19-print-card-addresses.test.mjs
// Paper cannot click, so a printed program card must say where its buttons go. The general print rule
// in style.css skips .btn links, so a second print rule prints the address after the "Official page" and
// "Apply" buttons inside a program card (.prog). The rule must not match the GitHub buttons on contribute.html
// or about.html, which are not in a .prog card and may stay unprinted.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

const RULE_SELECTOR = '.prog a.btn[href^="http"]:not(.noprint)::after';
// The same selector without the pseudo-element, for querySelectorAll in jsdom.
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

// Returns the declarations of the print rule whose selector is exactly RULE_SELECTOR, or null.
function cardAddressRule(css) {
  for (const body of printBodies(css)) {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(body))) {
      if (m[1].trim() === RULE_SELECTOR) return m[2];
    }
  }
  return null;
}

// Loads a page and waits for its program list to finish loading, as the print tests do.
async function loadWithLists(file) {
  const page = await loadPage(file);
  for (let i = 0; i < 80 && /Loading/.test(page.document.getElementById("count")?.textContent || ""); i++) await tick(25);
  return page;
}

test("card addresses: the print block has a rule for .prog Official page and Apply buttons that prints attr(href)", () => {
  const decls = cardAddressRule(CSS);
  assert.ok(decls, `no print rule with selector ${RULE_SELECTOR}`);
  assert.match(decls, /content:\s*"\s*\(\s*"\s*attr\(href\)\s*"\s*\)"/, "rule must print the address with attr(href) in parentheses");
});

test("card addresses: the general address rule still skips .btn links", () => {
  const general = 'main a[href^="http"]:not(.btn):not(.noprint)::after';
  assert.ok(
    printBodies(CSS).some((body) => body.includes(general)),
    "general address rule for links in main is missing or changed"
  );
});

test("card addresses: on find.html every program card with an official page link has that link matched", async () => {
  const { document, errors } = await loadWithLists("find.html");
  assert.deepEqual(errors, []);
  const cards = [...document.querySelectorAll("article.prog")];
  assert.ok(cards.length > 0, "program cards should be rendered");
  const matched = new Set(document.querySelectorAll(ELEMENT_SELECTOR));
  let withUrl = 0;
  for (const card of cards) {
    const official = [...card.querySelectorAll("a.btn")].find((a) => /^Official page/.test(a.textContent.trim()));
    if (!official) continue;
    withUrl++;
    assert.ok(matched.has(official), "an Official page link in a card is not matched by the print rule's selector");
  }
  assert.ok(withUrl > 0, "expected at least one card with an Official page link");
  assert.ok(matched.size >= withUrl, "print rule should match at least one link per card with a url");
});

test("card addresses: the selector matches no GitHub buttons on contribute.html or about.html", async () => {
  for (const file of ["contribute.html", "about.html"]) {
    const { document, errors } = await loadPage(file);
    assert.deepEqual(errors, [], `${file} should load without errors`);
    assert.ok(
      document.querySelectorAll('a.btn[href^="http"]').length > 0,
      `${file} should have absolute .btn links to make this check meaningful`
    );
    assert.equal(document.querySelectorAll(ELEMENT_SELECTOR).length, 0, `${file}: the card address selector should match 0 nodes`);
  }
});
