// Page-set agreement: src templates, built pages, sitemap, canonical tags and the home page nav/footer must line up.
// Run with: node --test tests/r1-tests-4-page-set-agreement.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const BASE = "https://vadneyk.github.io/internships/";
// The newest date the sitemap may carry: tomorrow in UTC (a build in a time zone ahead of UTC can already be on the next day).
const TODAY = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

// Documented exceptions.
const NOT_IN_SITEMAP = new Set(["404.html", "leaders.html", "ignition.html"]); // error page; noindex pages
const NOT_LINKED_FROM_HOME = new Set(["404.html", "index.html", "leaders.html", "ignition.html"]); // error page; the home page itself; noindex pages

const src = new Set(readdirSync(join(root, "src")).filter((f) => f.endsWith(".html") && f !== "_layout.html"));
const built = new Set(readdirSync(root).filter((f) => f.endsWith(".html")));
const sitemapXml = read("sitemap.xml");
const entries = [...sitemapXml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?/g)].map((m) => ({ loc: m[1], lastmod: m[2] }));
const base = (loc) => (loc === BASE ? "index.html" : loc.startsWith(BASE) ? loc.slice(BASE.length) : "OUTSIDE:" + loc);
const sitemap = new Set(entries.map((e) => base(e.loc)));
const canonicalOf = (f) => {
  const m = read(f).match(/<link\s+rel="canonical"\s+href="([^"]*)"/);
  return m ? m[1] : null;
};
const diff = (a, b) => [...a].filter((x) => !b.has(x)).sort();

test("built root html files equal src templates", () => {
  assert.deepEqual(diff(src, built), [], "in src but not built: " + diff(src, built));
  assert.deepEqual(diff(built, src), [], "built but no src template: " + diff(built, src));
});

test("sitemap equals built pages minus the documented exclusions", () => {
  const expected = new Set([...built].filter((f) => !NOT_IN_SITEMAP.has(f)));
  assert.equal(entries.length, sitemap.size, "duplicate sitemap entries");
  assert.deepEqual(diff(expected, sitemap), [], "built but missing from sitemap.xml: " + diff(expected, sitemap));
  assert.deepEqual(diff(sitemap, expected), [], "in sitemap.xml but not expected: " + diff(sitemap, expected));
});

test("every built page has a canonical that points at itself", () => {
  for (const f of built) {
    const want = f === "index.html" ? BASE : BASE + f;
    assert.equal(canonicalOf(f), want, f + ": canonical should be " + want);
  }
});

test("every sitemap lastmod is a real ISO date, not in the future", () => {
  for (const e of entries) {
    const name = base(e.loc);
    assert.match(e.lastmod || "", /^\d{4}-\d{2}-\d{2}$/, name + ": lastmod missing or not YYYY-MM-DD");
    const d = new Date(e.lastmod + "T00:00:00Z");
    assert.equal(d.toISOString().slice(0, 10), e.lastmod, name + ": lastmod is not a real date");
    assert.ok(e.lastmod <= TODAY, name + ": lastmod " + e.lastmod + " is after " + TODAY);
  }
});

test("every page except the exclusions is linked from the nav or footer of index.html", () => {
  const doc = new JSDOM(read("index.html")).window.document;
  const linked = new Set();
  for (const a of doc.querySelectorAll("nav.nav a[href], footer a[href]")) {
    const h = a.getAttribute("href").split("#")[0].split("?")[0].replace(/^\.\//, "");
    linked.add(h === "" || h === "./" ? "index.html" : h);
  }
  for (const f of built) {
    if (NOT_LINKED_FROM_HOME.has(f)) continue;
    assert.ok(linked.has(f), f + " is not linked from the nav or footer of index.html");
  }
});
