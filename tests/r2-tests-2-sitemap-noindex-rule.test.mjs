// The sitemap, the noindex meta tags and robots.txt must agree for every root page.
// Rule: each root .html page (all but 404.html) is either listed in sitemap.xml exactly once,
// or carries <meta name="robots" content="noindex"> and is not listed at all.
// Every sitemap <loc> must map to a real file, every <lastmod> must be a valid ISO date,
// and no <lastmod> may be later than the newest footer "Last checked" date.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://vadneyk.github.io/internships/";
const EXCLUDED = new Set(["404.html"]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

export function rootPages(dir = ROOT) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".html") && !EXCLUDED.has(f))
    .sort();
}

// True when the page has a robots meta with the noindex token.
export function isNoindex(html) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\bname\s*=\s*["']robots["']/i.test(tag)) continue;
    const content = (tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i) || [])[1] || "";
    if (content.split(",").map((t) => t.trim().toLowerCase()).includes("noindex")) return true;
  }
  return false;
}

// Footer "Last checked Oct 10, 2026." becomes an ISO date. Returns null when absent.
export function footerDate(html) {
  const m = html.match(/Last checked\s+([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/);
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1]);
  if (mon < 0) return null;
  return `${m[3]}-${String(mon + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

export function isIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Parse <url> blocks of sitemap.xml into {loc, lastmod}.
export function sitemapEntries(xml) {
  const out = [];
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]*)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>\s*<\/url>/g)) {
    out.push({ loc: m[1].trim(), lastmod: m[2].trim() });
  }
  return out;
}

// Map a sitemap loc to its root file name, or null when it is not under the site.
export function locToFile(loc) {
  if (!loc.startsWith(SITE)) return null;
  const rest = loc.slice(SITE.length);
  if (rest === "" || rest === "index.html") return "index.html";
  return rest;
}

// Pure rule check. files: {name: html}. xml: sitemap text. Returns a list of problems, each naming its page.
export function ruleProblems(files, xml, extra = {}) {
  const problems = [];
  const entries = sitemapEntries(xml);
  const counts = new Map();
  for (const e of entries) {
    const file = locToFile(e.loc);
    if (file === null) {
      problems.push(`sitemap loc ${e.loc} is not under ${SITE}`);
      continue;
    }
    if (!(file in files)) {
      problems.push(`sitemap loc ${e.loc} maps to ${file}, which is not a root page (or is 404.html)`);
      continue;
    }
    counts.set(file, (counts.get(file) || 0) + 1);
  }

  for (const name of Object.keys(files).sort()) {
    const listed = counts.get(name) || 0;
    const noindex = isNoindex(files[name]);
    if (noindex && listed > 0) {
      problems.push(`${name} has a noindex meta but is listed in sitemap.xml (${listed} time(s))`);
    } else if (!noindex && listed === 0) {
      problems.push(`${name} has no noindex meta and is missing from sitemap.xml (add a sitemap line or a noindex meta)`);
    } else if (!noindex && listed > 1) {
      problems.push(`${name} is listed ${listed} times in sitemap.xml (must be exactly once)`);
    }
  }

  const newest = extra.newestFooter ?? null;
  for (const e of entries) {
    if (!isIsoDate(e.lastmod)) {
      problems.push(`sitemap lastmod "${e.lastmod}" for ${e.loc} is not a valid ISO date (YYYY-MM-DD)`);
      continue;
    }
    if (newest && e.lastmod > newest) {
      problems.push(`sitemap lastmod ${e.lastmod} for ${e.loc} is later than the newest footer Last checked date ${newest}`);
    }
  }
  return problems;
}

function newestFooterOf(files) {
  let newest = null;
  for (const html of Object.values(files)) {
    const d = footerDate(html);
    if (d && (newest === null || d > newest)) newest = d;
  }
  return newest;
}

function loadRoot() {
  const files = {};
  for (const f of rootPages()) files[f] = read(f);
  return files;
}

test("every root page is in sitemap.xml exactly once, or is noindex and not listed", () => {
  const files = loadRoot();
  const xml = read("sitemap.xml");
  const problems = ruleProblems(files, xml);
  assert.deepEqual(problems, [], "sitemap and noindex rule broken");
});

test("every sitemap loc maps to a real root file", () => {
  const files = loadRoot();
  const entries = sitemapEntries(read("sitemap.xml"));
  assert.ok(entries.length > 0, "sitemap.xml has no <url> entries");
  const bad = [];
  for (const e of entries) {
    const file = locToFile(e.loc);
    if (file === null) bad.push(`${e.loc} is not under ${SITE}`);
    else if (!(file in files) || !fs.existsSync(path.join(ROOT, file))) bad.push(`${e.loc} maps to ${file}, which is not a real root page`);
  }
  assert.deepEqual(bad, [], "sitemap loc does not match a file");
});

test("sitemap lastmod values are valid ISO dates and none is after the newest footer Last checked date", () => {
  const files = loadRoot();
  const newest = newestFooterOf(files);
  assert.ok(newest, "no footer Last checked date found on any root page");
  const bad = [];
  for (const e of sitemapEntries(read("sitemap.xml"))) {
    if (!isIsoDate(e.lastmod)) bad.push(`${e.loc}: lastmod "${e.lastmod}" is not a valid ISO date`);
    else if (e.lastmod > newest) bad.push(`${e.loc}: lastmod ${e.lastmod} is later than the newest footer Last checked date ${newest}`);
  }
  assert.deepEqual(bad, [], "lastmod problems");
});

test("seeded bad fixtures make each rule fire", () => {
  const page = (noindex) => `<html><head>${noindex ? '<meta name="robots" content="noindex">' : ""}</head><body><footer>Last checked Oct 10, 2026.</footer></body></html>`;
  const files = { "a.html": page(false), "b.html": page(true), "c.html": page(false) };
  const xml = [
    `<urlset>`,
    `<url><loc>${SITE}a.html</loc><lastmod>2026-10-10</lastmod></url>`,
    `<url><loc>${SITE}a.html</loc><lastmod>2026-10-10</lastmod></url>`,
    `<url><loc>${SITE}b.html</loc><lastmod>2026-10-10</lastmod></url>`,
    `<url><loc>${SITE}gone.html</loc><lastmod>2026-10-10</lastmod></url>`,
    `<url><loc>${SITE}c.html</loc><lastmod>2026-13-40</lastmod></url>`,
    `<url><loc>${SITE}c.html</loc><lastmod>2026-10-11</lastmod></url>`,
    `</urlset>`,
  ].join("\n");
  const problems = ruleProblems(files, xml, { newestFooter: "2026-10-10" }).join("\n");
  assert.match(problems, /a\.html is listed 2 times/, "duplicate listing should name a.html");
  assert.match(problems, /b\.html has a noindex meta but is listed/, "noindex page listed should name b.html");
  assert.match(problems, /gone\.html maps to gone\.html, which is not a root page/, "missing file should name gone.html");
  assert.match(problems, /2026-13-40/, "bad date should be named");
  assert.match(problems, /2026-10-11 for .*c\.html is later than the newest footer/, "future lastmod should be named");
  const missing = ruleProblems({ "d.html": page(false) }, `<urlset></urlset>`, {});
  assert.match(missing.join("\n"), /d\.html has no noindex meta and is missing from sitemap\.xml/, "unlisted page should name d.html");
});
