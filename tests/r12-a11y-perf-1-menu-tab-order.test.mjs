// Quality sweep 2026-10-16 (issue #9 sweep, docs/research/quality-sweep-2026-10.md items A1 to A3), found in headless Chrome.
// A1. The phone Menu button was added after the nav, so after opening the menu Tab went to the theme button and then out of the
//     header (which closes the menu): a keyboard user could reach the eight links only with Shift+Tab. The button now sits
//     before the nav, so the order is Menu, the links, then the theme button.
// A2. From 40 to 64rem wide the sticky header wraps to about 13rem (213 px at 768 px) while the focus offset is 8rem, so a
//     tabbed link on Parents or Rules ended up under the header (WCAG 2.4.11). The header now sticks only from 64rem, where it
//     is one row of links (107 px, under 7rem). This also covers 150% text on a 1280 px screen, which is under 64rem.
// A3. A tel: link never wrapped (white-space: nowrap), so "1-866-4-US-WAGE (1-866-487-9243)" pushed Safe at work 21 px past a
//     320 px screen (WCAG 1.4.10). It is now an inline-block: it moves to the next line whole and wraps only when wider than the line.
// Run with: node --test tests/r12-a11y-perf-1-menu-tab-order.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = new URL("../", import.meta.url);
const CSS = fs.readFileSync(new URL("assets/css/style.css", ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "404.html").sort();

// Tab order in jsdom: document order of the focusable header controls (no positive tabindex anywhere in the header).
function headerTabOrder(document) {
  const top = document.querySelector("header.top");
  return [...top.querySelectorAll("a[href], button")].map((el) =>
    el.classList.contains("menu-btn") ? "menu" : el.id === "themeBtn" ? "theme" : el.closest(".nav") ? "link" : "brand");
}

for (const page of ["index.html", "find.html", "rules.html"]) {
  test(`A1 ${page}: the Menu button comes right before the nav, so Tab goes Menu, the eight links, then the theme button`, async () => {
    const p = await loadPage(page); await tick(80);
    const { document } = p;
    const m = document.querySelector("header.top .menu-btn"), nav = document.querySelector("header.top .nav");
    assert.ok(m && nav, "Menu button and nav exist");
    assert.equal(nav.previousElementSibling, m, "Menu sits right before the nav");
    assert.equal(m.getAttribute("aria-controls"), nav.id);
    const order = headerTabOrder(document);
    assert.deepEqual(order, ["brand", "menu", "link", "link", "link", "link", "link", "link", "link", "link", "theme"]);
    assert.equal(document.querySelectorAll("header.top [tabindex]:not([tabindex='-1'])").length, 0, "no tabindex reorders the header");
  });
}

test("A1: every built page keeps the header links between the Menu button and the theme button", () => {
  for (const f of PAGES) {
    const html = fs.readFileSync(new URL(f, ROOT), "utf8");
    const top = html.slice(html.indexOf('<header class="top">'), html.indexOf("</header>"));
    assert.ok(top.indexOf('<nav class="nav"') > 0 && top.indexOf('<nav class="nav"') < top.indexOf('id="themeBtn"'), f + ": nav comes before the theme button");
  }
  const common = fs.readFileSync(new URL("assets/js/common.js", ROOT), "utf8");
  assert.match(common, /nav\.parentNode\.insertBefore\(m, nav\)/, "common.js puts the Menu button before the nav");
  assert.doesNotMatch(common, /btn\.parentNode\.insertBefore\(m, btn\)/);
});

test("A1: the phone header spacing rule still reaches the theme button now that the nav sits between them", () => {
  assert.match(CSS, /\.menu-btn ~ \.theme-btn \{ margin-left: 0; \}/);
  assert.doesNotMatch(CSS, /\.menu-btn \+ \.theme-btn/, "the adjacent sibling rule no longer matches and would push the theme button right");
});

function mediaBlocks(css) {
  const out = [], re = /@media\s*([^{]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1, i = re.lastIndex;
    while (i < css.length && depth > 0) { if (css[i] === "{") depth++; else if (css[i] === "}") depth--; i++; }
    out.push({ query: m[1].trim(), body: css.slice(re.lastIndex, i - 1) });
  }
  return out;
}

test("A2: the header is sticky only from 64rem wide, where it is one row of links", () => {
  const sticky = mediaBlocks(CSS).filter((b) => /\.top\s*\{\s*position:\s*sticky/.test(b.body));
  assert.equal(sticky.length, 1, "one sticky header block");
  const w = /min-width:\s*([\d.]+)rem/.exec(sticky[0].query);
  assert.ok(w && parseFloat(w[1]) >= 64, "sticky min-width must be at least 64rem, found " + sticky[0].query);
  assert.match(sticky[0].query, /min-height:\s*34rem/, "the short screen guard stays");
  assert.match(sticky[0].body, /html \{ scroll-padding-top: 8rem; \}/, "focus offset stays at 8rem, over the one-row header");
});

test("A2 mutation: the old 40.0625rem threshold fails the check", () => {
  const old = CSS.replace(/@media \(min-width: 64rem\) and \(min-height: 34rem\)/, "@media (min-width: 40.0625rem) and (min-height: 34rem)");
  const sticky = mediaBlocks(old).filter((b) => /\.top\s*\{\s*position:\s*sticky/.test(b.body));
  assert.ok(parseFloat(/min-width:\s*([\d.]+)rem/.exec(sticky[0].query)[1]) < 64);
});

test("A3: a phone number link is an inline-block and has no nowrap, so a long one wraps on a 320 px screen", () => {
  const rule = /a\[href\^="tel:"\]\s*\{([^}]*)\}/g;
  const bodies = [];
  let m;
  while ((m = rule.exec(CSS))) bodies.push(m[1]);
  assert.ok(bodies.some((b) => /display:\s*inline-block/.test(b)), "a[href^=tel:] { display: inline-block }");
  assert.ok(!bodies.some((b) => /white-space:\s*nowrap/.test(b)), "no nowrap on tel links");
  assert.equal([...CSS.matchAll(/\.btn[^{,]*\[href\^="tel:"\]/g)].length, 0, "no button-styled tel links that the inline-block would change");
});
