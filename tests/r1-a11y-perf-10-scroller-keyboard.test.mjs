// WCAG 2.1.1 (keyboard): a scroll box must be reachable with the keyboard, or a reader at phone width or 400 percent zoom cannot see the cut-off columns.
// Part 1 checks every .tablewrap in the built DOM of every root page. Part 2 checks style.css: every selector with an overflow auto or scroll
// rule (other than .tablewrap, which part 1 covers) must be on the reviewed allow-list below, so a new scroll box fails until someone reviews it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// Scroll boxes in style.css, other than .tablewrap, that are allowed on purpose. Each entry is [selector, reason].
// Empty today: no CSS rule other than .tablewrap makes a box scroll.
const SCROLL_ALLOW = new Map([
  // [".example-scroller", "why this box may scroll without tabindex, and why that is safe"],
]);

// Returns the selectors of every rule whose declarations set overflow, overflow-x or overflow-y to auto or scroll.
// Works on rules inside @media blocks too, because it reads innermost { ... } blocks only.
function scrollSelectors(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    if (!/(^|[;\s])overflow(-x|-y)?\s*:\s*(auto|scroll)\b/i.test(m[2])) continue;
    const prelude = m[1].split(";").pop(); // drop any @import or @charset line before the selector
    for (const sel of prelude.split(",")) {
      const s = sel.replace(/\s+/g, " ").trim();
      if (s) out.push(s);
    }
  }
  return out;
}

// Checks every .tablewrap in a document: tabindex 0, role region, a non-empty aria-label, and no label repeated on that page.
function checkWraps(f, doc) {
  const wraps = [...doc.querySelectorAll(".tablewrap")];
  const labels = [];
  wraps.forEach((el, i) => {
    const label = (el.getAttribute("aria-label") || "").trim();
    const where = f + " .tablewrap " + i + " (" + (label || "no aria-label") + ")";
    assert.equal(el.getAttribute("tabindex"), "0", where + " needs tabindex=\"0\" so the keyboard can scroll it");
    assert.equal(el.getAttribute("role"), "region", where + " needs role=\"region\"");
    assert.ok(label, where + " needs a non-empty aria-label");
    labels.push(label);
  });
  assert.equal(new Set(labels).size, labels.length, f + ": .tablewrap aria-labels repeat: " + labels.join(" | "));
  return wraps.length;
}

test("every .tablewrap on every built root page is keyboard reachable and named", async () => {
  assert.ok(pages.length >= 7, "found " + pages.length + " root pages");
  let total = 0;
  for (const f of pages) {
    const { document } = await loadPage(f);
    await tick(200);
    total += checkWraps(f, document);
  }
  assert.ok(total >= 9, "found " + total + " .tablewrap regions");
});

test("the paycheck estimate wrapper is checked after a calculation", async () => {
  const { window, document } = await loadPage("paycheck.html");
  await tick(200);
  type(window, document.getElementById("mWage"), "15");
  type(window, document.getElementById("mHours"), "10");
  await tick(200);
  assert.ok(document.querySelector("#mOut .tablewrap"), "estimate wrapper shows after a calculation");
  assert.ok(checkWraps("paycheck.html", document) >= 1);
});

test("every style.css scroll box other than .tablewrap is on the reviewed allow-list", () => {
  const css = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
  const found = scrollSelectors(css);
  assert.ok(found.includes(".tablewrap"), "the CSS scan must see .tablewrap, or the parser is broken");
  const unreviewed = found.filter((s) => s !== ".tablewrap" && !SCROLL_ALLOW.has(s));
  assert.deepEqual(unreviewed, [], "scroll box(es) in style.css need a keyboard check and an allow-list entry with a reason: " + unreviewed.join(" | "));
  for (const s of SCROLL_ALLOW.keys()) assert.ok(found.includes(s), "allow-list entry no longer matches a scroll box in style.css: " + s);
});

test("the CSS scan catches a new scroll box, including one inside @media", () => {
  const sample = "/* note */ @media (max-width: 40em) { .new-scroller { overflow-x: auto; } } .a, .b { overflow: scroll } .c { overflow-wrap: anywhere; overflow: hidden }";
  assert.deepEqual(scrollSelectors(sample), [".new-scroller", ".a", ".b"]);
});
