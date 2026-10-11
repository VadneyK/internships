// The 404 page, robots.txt and sitemap.xml under the /internships/ subpath.
// The site is served from https://vadneyk.github.io/internships/, so the 404 page can be shown for a URL at any depth.
// A link that is relative (for example "assets/css/style.css" or "index.html") resolves against the deep URL the visitor asked for and breaks.
// So a link is safe only when it is an absolute URL under the site, a root path under /internships/, a same-page fragment, or a data: URL (which has no path).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://vadneyk.github.io/internships/";
const SITEMAP_URL = SITE + "sitemap.xml";
const HOME_HREFS = [SITE, SITE + "index.html", "/internships/", "/internships/index.html", "index.html"];

const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function isSafeLink(v) {
  return /^(https:|mailto:|tel:|sms:)/i.test(v) || v.startsWith(SITE) || v.startsWith("/internships/") || v.startsWith("#") || v.startsWith("data:");
}

// Every href and src on the page, and every url() in an inline style block, must be safe under the subpath.
function linkProblems(doc) {
  const out = [];
  for (const el of doc.querySelectorAll("[href],[src]")) {
    for (const attr of ["href", "src"]) {
      const v = el.getAttribute(attr);
      if (v === null || v === "" || isSafeLink(v)) continue;
      out.push(`${el.tagName.toLowerCase()} ${attr}="${v}" is not absolute or under /internships/`);
    }
  }
  for (const style of doc.querySelectorAll("style")) {
    for (const m of style.textContent.matchAll(/url\(\s*['"]?([^'")\s]+)/g)) {
      if (!isSafeLink(m[1])) out.push(`style url(${m[1]}) is not absolute or under /internships/`);
    }
  }
  return out;
}

// Page shape: a title, one h1 with text, one main landmark, a link home, and no script from another host.
function pageProblems(doc) {
  const out = [];
  if (!(doc.title || "").trim()) out.push("no title");
  const h1s = doc.querySelectorAll("h1");
  if (h1s.length !== 1 || !(h1s[0].textContent || "").trim()) out.push(`expected one non-empty h1, found ${h1s.length}`);
  const mains = doc.querySelectorAll("main, [role=main]");
  if (mains.length !== 1) out.push(`expected one main landmark, found ${mains.length}`);
  const home = [...doc.querySelectorAll("a[href]")].some((a) => HOME_HREFS.includes(a.getAttribute("href")));
  if (!home) out.push("no link home");
  for (const s of doc.querySelectorAll("script[src]")) {
    const v = s.getAttribute("src");
    if (/^(https?:)?\/\//i.test(v) && !v.startsWith(SITE)) out.push(`external script: ${v}`);
  }
  return out;
}

// robots.txt: the Sitemap line names the real sitemap URL, and no rule blocks the whole site.
function robotProblems(text) {
  const out = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const maps = lines.filter((l) => /^sitemap:/i.test(l)).map((l) => l.slice("sitemap:".length).trim());
  if (!maps.includes(SITEMAP_URL)) out.push(`no Sitemap line equal to ${SITEMAP_URL} (found: ${maps.join(", ") || "none"})`);
  for (const l of lines) {
    const m = /^disallow:\s*(.*)$/i.exec(l);
    if (m && m[1].trim() === "/") out.push("Disallow: / blocks the whole site");
  }
  return out;
}

// sitemap.xml: every URL is under the site, and the 404 page is not listed.
function sitemapProblems(xml) {
  const out = [];
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) out.push("no <loc> entries");
  for (const loc of locs) {
    if (!loc.startsWith(SITE)) out.push(`URL outside the site: ${loc}`);
    if (/404/.test(loc)) out.push(`sitemap lists the 404 page: ${loc}`);
  }
  return out;
}

const docOf = (html) => new JSDOM(html).window.document;

test("404.html: title, one h1, one main, a link home, no external script", async () => {
  const page = await loadPage("404.html");
  await tick(100);
  assert.deepEqual(pageProblems(page.document), []);
});

test("404.html: loads in jsdom with no console errors", async () => {
  const page = await loadPage("404.html");
  await tick(100);
  // The test server serves the repo at its root, so the page's root-anchored /internships/ files are not found there. That is a harness limit, not a page error.
  const errors = page.errors.filter((e) => !/Could not load (link|script): "http:\/\/127\.0\.0\.1:\d+\/internships\//.test(e));
  assert.deepEqual(errors, [], "page errors");
});

// The 404 page is root-anchored under /internships/, so it works on a deep mistyped URL too.
test("404.html: every link is absolute or under /internships/ (no link problems)", async () => {
  const page = await loadPage("404.html");
  await tick(100);
  assert.deepEqual(linkProblems(page.document), []);
});

test("robots.txt: Sitemap line is the real sitemap URL and nothing blocks the whole site", () => {
  assert.deepEqual(robotProblems(read("robots.txt")), []);
});

test("sitemap.xml: lists only URLs under the site and not 404.html", () => {
  assert.deepEqual(sitemapProblems(read("sitemap.xml")), []);
});

// Seeded bad fixtures: each rule must fire on a page or file that breaks it.
test("seeded bad fixtures make each rule fire", () => {
  const goodPage = `<!doctype html><html><head><title>Gone</title></head><body><main><h1>Not found</h1>
    <a href="${SITE}index.html">Home</a><link rel="stylesheet" href="${SITE}assets/css/style.css"><use href="#flame"></main></body></html>`;
  assert.deepEqual(pageProblems(docOf(goodPage)), []);
  assert.deepEqual(linkProblems(docOf(goodPage)), []);

  const noTitle = `<html><head></head><body><main><h1>x</h1><a href="/internships/">Home</a></main></body></html>`;
  assert.ok(pageProblems(docOf(noTitle)).some((p) => p.includes("title")), "title rule");

  const noH1 = `<html><head><title>t</title></head><body><main><p>x</p><a href="index.html">Home</a></main></body></html>`;
  assert.ok(pageProblems(docOf(noH1)).some((p) => p.includes("h1")), "h1 rule");

  const noMain = `<html><head><title>t</title></head><body><h1>x</h1><a href="index.html">Home</a></body></html>`;
  assert.ok(pageProblems(docOf(noMain)).some((p) => p.includes("main")), "main rule");

  const noHome = `<html><head><title>t</title></head><body><main><h1>x</h1><a href="find.html">Find</a></main></body></html>`;
  assert.ok(pageProblems(docOf(noHome)).some((p) => p.includes("link home")), "home rule");

  const extScript = `<html><head><title>t</title><script src="https://cdn.example.com/lib.js"></script></head><body><main><h1>x</h1><a href="index.html">Home</a></main></body></html>`;
  assert.ok(pageProblems(docOf(extScript)).some((p) => p.includes("external script")), "external script rule");

  const relHref = `<html><head><title>t</title></head><body><main><h1>x</h1><a href="index.html">Home</a></main></body></html>`;
  assert.ok(linkProblems(docOf(relHref)).some((p) => p.includes('href="index.html"')), "relative href rule");

  const relCss = `<html><head><title>t</title><link rel="stylesheet" href="assets/css/style.css"></head><body></body></html>`;
  assert.ok(linkProblems(docOf(relCss)).some((p) => p.includes("assets/css/style.css")), "relative css rule");

  const relImg = `<html><head><title>t</title></head><body><img src="assets/img/x.png" alt=""></body></html>`;
  assert.ok(linkProblems(docOf(relImg)).some((p) => p.includes("assets/img/x.png")), "relative src rule");

  const relStyleUrl = `<html><head><title>t</title><style>.a{background:url(assets/img/bg.svg)}</style></head><body></body></html>`;
  assert.ok(linkProblems(docOf(relStyleUrl)).some((p) => p.includes("assets/img/bg.svg")), "relative style url rule");

  assert.ok(robotProblems("User-agent: *\nDisallow: /\nSitemap: " + SITEMAP_URL).some((p) => p.includes("Disallow: /")), "disallow rule");
  assert.ok(robotProblems("User-agent: *\nAllow: /\nSitemap: https://vadneyk.github.io/sitemap.xml").some((p) => p.includes("no Sitemap line")), "sitemap line rule");
  assert.ok(robotProblems("User-agent: *\nAllow: /\n").some((p) => p.includes("no Sitemap line")), "missing sitemap rule");
  assert.deepEqual(robotProblems("User-agent: *\nAllow: /\nSitemap: " + SITEMAP_URL + "\n"), []);

  const badSitemap = `<urlset><url><loc>${SITE}404.html</loc></url><url><loc>https://example.com/x</loc></url></urlset>`;
  const sitemapFindings = sitemapProblems(badSitemap);
  assert.ok(sitemapFindings.some((p) => p.includes("404")), "404 in sitemap rule");
  assert.ok(sitemapFindings.some((p) => p.includes("outside the site")), "outside-site rule");
  assert.deepEqual(sitemapProblems(`<urlset><url><loc>${SITE}find.html</loc></url></urlset>`), []);
});
