// Ticket r2-a11y-perf-8: the footer "Quick links" column is a real list, one item per link, with tall tap targets.
// Every built root page is parsed with JSDOM (no scripts run). The CSS checks read style.css as text,
// the same way as tests/a11y.dom.test.mjs and tests/r2-a11y-perf-7.test.mjs.
// Run with: node --test tests/r2-a11y-perf-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// The link targets in the Quick links column, in order, taken from src/_layout.html before this change.
// The ticket said 13, but the old line held 14 links separated by 13 line breaks. All 14 are kept so no link is lost.
const QUICK_HREFS = [
  "find.html",
  "playbook.html",
  "resume.html",
  "ready.html",
  "calendar.html",
  "paycheck.html",
  "younger.html",
  "interview.html",
  "permit.html",
  "languages.html",
  "insights.html",
  "rules.html",
  "states.html",
  "contribute.html",
];

const parsedCache = new Map();
function staticDoc(file) {
  if (!parsedCache.has(file)) {
    parsedCache.set(file, new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document);
  }
  return parsedCache.get(file);
}

// The column (a div) whose h2 reads "Quick links".
function quickLinksColumn(doc) {
  const heading = [...doc.querySelectorAll(".foot h2")].find((h) => h.textContent.trim() === "Quick links");
  return heading ? heading.parentElement : null;
}

// Same helpers as tests/a11y.dom.test.mjs. Comments are removed from the CSS first.
function ruleBodies(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...CSS.matchAll(new RegExp("(?:^|[\\s}])" + esc + "\\s*\\{([^}]*)\\}", "g"))].map((m) => m[1]);
}
function declared(bodies, prop) {
  const out = [];
  for (const b of bodies) {
    for (const m of b.matchAll(new RegExp("(?:^|[;\\s])(?:min-)?" + prop + "\\s*:\\s*([^;]+)", "g"))) out.push(m[1].trim());
  }
  return out;
}
function toRem(v) {
  const m = /^([\d.]+)(rem|px)$/.exec(v);
  if (!m) return NaN;
  return m[2] === "rem" ? Number(m[1]) : Number(m[1]) / 16;
}

for (const file of PAGES) {
  test(`${file}: Quick links is a list with 14 items, one link each`, () => {
    const doc = staticDoc(file);
    const col = quickLinksColumn(doc);
    assert.ok(col, "no footer column headed Quick links");
    const ul = col.querySelector("ul");
    assert.ok(ul, "Quick links column has no ul");
    assert.ok(ul.classList.contains("qlinks"), "list is missing the qlinks class");
    const items = [...ul.children];
    assert.ok(items.every((el) => el.tagName === "LI"), "ul has a child that is not an li");
    assert.equal(items.length, QUICK_HREFS.length, `expected ${QUICK_HREFS.length} li, found ${items.length}`);
    for (const li of items) {
      assert.equal(li.children.length, 1, `li does not hold exactly one child: ${li.outerHTML.slice(0, 80)}`);
      assert.equal(li.firstElementChild.tagName, "A", "li child is not an a");
    }
  });

  test(`${file}: Quick links hrefs match the list from before this change, in order`, () => {
    const col = quickLinksColumn(staticDoc(file));
    const hrefs = [...col.querySelectorAll("li > a")].map((a) => a.getAttribute("href"));
    assert.deepEqual(hrefs, QUICK_HREFS);
  });

  test(`${file}: the footer has no line break (br) inside it`, () => {
    const doc = staticDoc(file);
    assert.equal(doc.querySelectorAll("footer.foot br").length, 0, "a br is still in the footer");
  });
}

test("style.css: .foot li a is inline-flex or block with a min-height of at least 1.5rem (2.25rem preferred)", () => {
  const bodies = ruleBodies(".foot li a");
  assert.ok(bodies.length > 0, "no .foot li a rule");
  const displays = declared(bodies, "display");
  assert.ok(displays.length > 0, ".foot li a has no display");
  for (const v of displays) assert.ok(["inline-flex", "block"].includes(v), `.foot li a display is ${v}`);
  const heights = declared(bodies, "min-height");
  assert.ok(heights.length > 0, ".foot li a has no min-height");
  for (const v of heights) assert.ok(toRem(v) >= 1.5, `.foot li a min-height is ${v}`);
  assert.ok(heights.some((v) => toRem(v) >= 2.25), `.foot li a min-height should be at least 2.25rem, got ${heights.join(", ")}`);
});

test("style.css: the Quick links list has list-style none and no left padding", () => {
  const bodies = ruleBodies(".foot .qlinks");
  assert.ok(bodies.length > 0, "no .foot .qlinks rule");
  assert.deepEqual(declared(bodies, "list-style"), ["none"]);
  const pad = declared(bodies, "padding-left");
  assert.ok(pad.length > 0, ".foot .qlinks sets no padding-left");
  for (const v of pad) assert.ok(["0", "0px", "0rem"].includes(v), `.foot .qlinks padding-left is ${v}`);
});
