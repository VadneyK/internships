// Footer Quick links are a labelled nav landmark (ticket r5-a11y-perf-4).
// Screen reader users jump by landmark, so the footer site map must be a nav named "Quick links".
// Run with: node --test tests/r5-a11y-perf-4-footer-nav-landmark.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LAYOUT = fs.readFileSync(path.join(ROOT, "src/_layout.html"), "utf8");

// The hrefs of the footer Quick links, read from the layout template (the source of every built page).
function layoutQuickLinkHrefs() {
  const m = /<nav aria-label="Quick links">([\s\S]*?)<\/nav>/.exec(LAYOUT);
  assert.ok(m, 'src/_layout.html has no <nav aria-label="Quick links">');
  return [...m[1].matchAll(/<a href="([^"]+)"/g)].map((x) => x[1]);
}

const EXPECTED = layoutQuickLinkHrefs();

// Every built root page.
const PAGES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort();

test("the layout template lists the 19 footer quick links", () => {
  assert.equal(EXPECTED.length, 19, "expected 19 quick links, found " + EXPECTED.length);
});

test("built root pages exist to check", () => {
  assert.ok(PAGES.length >= 20, "expected the built root pages, found " + PAGES.length);
});

test("every built page has exactly one Main nav in the header", () => {
  for (const f of PAGES) {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document;
    const navs = doc.querySelectorAll('nav[aria-label="Main"]');
    assert.equal(navs.length, 1, f + " has " + navs.length + ' nav[aria-label="Main"]');
    assert.ok(navs[0].closest("header"), f + " Main nav is not inside the header");
  }
});

test("every built page has exactly one Quick links nav inside footer.foot", () => {
  for (const f of PAGES) {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document;
    const navs = doc.querySelectorAll('nav[aria-label="Quick links"]');
    assert.equal(navs.length, 1, f + " has " + navs.length + ' nav[aria-label="Quick links"]');
    assert.ok(navs[0].closest("footer.foot"), f + " Quick links nav is not inside footer.foot");
  }
});

test("the footer Quick links nav holds the same 19 hrefs as before, in order", () => {
  for (const f of PAGES) {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document;
    const nav = doc.querySelector('footer.foot nav[aria-label="Quick links"]');
    assert.ok(nav, f + " has no footer Quick links nav");
    const lists = nav.querySelectorAll("ul.qlinks");
    assert.ok(lists.length > 0, f + " Quick links nav has no ul.qlinks");
    const hrefs = [...nav.querySelectorAll("ul.qlinks li > a")].map((a) => a.getAttribute("href"));
    // Some pages (404.html) carry the site base path in front of each href, so match the file name at the end.
    assert.equal(hrefs.length, EXPECTED.length, f + " has " + hrefs.length + " quick links");
    hrefs.forEach((h, i) => {
      const want = EXPECTED[i];
      assert.ok(h === want || h.endsWith("/" + want), f + " quick link " + (i + 1) + " is " + h + ", want " + want);
    });
  }
});

test("the footer Quick links heading stays as an h2 inside the nav", () => {
  for (const f of PAGES) {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document;
    const nav = doc.querySelector('footer.foot nav[aria-label="Quick links"]');
    const h2 = nav && nav.querySelector("h2.fh");
    assert.ok(h2, f + " has no h2 in the Quick links nav");
    assert.equal(h2.textContent.trim(), "Quick links", f + " footer heading is " + h2.textContent.trim());
  }
});

test("no built page has two navs with the same aria-label", () => {
  for (const f of PAGES) {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document;
    const seen = new Map();
    for (const nav of doc.querySelectorAll("nav[aria-label]")) {
      const name = nav.getAttribute("aria-label");
      seen.set(name, (seen.get(name) || 0) + 1);
    }
    for (const [name, count] of seen) {
      assert.ok(count === 1, f + ' has ' + count + ' navs named "' + name + '"');
    }
  }
});
