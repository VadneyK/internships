// Every local file the site names must exist, and every file in assets/img, assets/qr and assets/fonts must be named by something.
// Plain file reads, regular expressions and jsdom parsing (no page script runs, no network). Run with:
//   node --test tests/r1-tests-2-asset-refs.test.mjs
//
// What it scans:
// - root *.html: script src, img src and srcset, source src and srcset, iframe src, link href (every rel), a href to a
//   non-HTML file, and the og:image, twitter:image and itemprop image meta tags
// - assets/css/*.css: every url(...) (resolved from the stylesheet's own folder)
// - assets/js/*.js: every string literal that starts with assets/ or data/ and names a file (resolved from the site root,
//   since pages load them). A download name such as "my-people-map.png" is not a file the site reads, so it is not checked.
// Query strings (?v=...) and hashes are stripped. Absolute web addresses, data: URIs, template placeholders and bare
// fragments are not local files and are skipped. A path that starts with "/" or climbs out of the repo fails, because
// the site runs under /internships/ on GitHub Pages and such a path would 404 for a reader.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const listDir = (dir, ext) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).sort();
const ROOT_HTML = listDir(".", ".html");
const CSS_FILES = listDir("assets/css", ".css").map((f) => "assets/css/" + f);
const JS_FILES = listDir("assets/js", ".js").map((f) => "assets/js/" + f);

// Folders whose every file must be named by a scanned page, stylesheet or script.
const ORPHAN_FOLDERS = ["assets/img", "assets/qr", "assets/fonts"];

// Files in ORPHAN_FOLDERS that nothing names but that are kept on purpose: { file, why }. Empty today.
// A listed file that is gone, or that is named by something now, fails so the entry gets removed.
const ORPHAN_ALLOW = [];

// Anything with a scheme (https:, data:, mailto:, tel:, javascript:), a protocol-relative address or a bare fragment.
const NOT_LOCAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
// The public address the site uses in its own links. A reference to a file under it is a local file.
const SITE_PREFIX = "https://vadneyk.github.io/internships/";
// A JS string literal that names a file under assets/ or data/: a known extension, no spaces, no template pieces.
const JS_FILE_LITERAL = /^(?:\.{1,2}\/)?(?:assets|data)\/[\w\-\/%][\w.\-\/%]*\.(?:svg|png|jpe?g|gif|webp|ico|woff2?|ttf|css|js|json|csv|pdf|txt|xml)(?:[?#][^\s]*)?$/i;

// Turns one written reference into a repo-relative path, or null when it is not a local file.
function localPath(raw) {
  let v = String(raw || "").trim();
  if (v.startsWith(SITE_PREFIX)) v = v.slice(SITE_PREFIX.length);
  if (!v || NOT_LOCAL.test(v) || v.includes("{{") || v.includes("${")) return null;
  v = v.split("?")[0].split("#")[0];
  if (!v) return null;
  try { v = decodeURIComponent(v); } catch { return { bad: "not a valid URL path" }; }
  // An encoded fragment (url(%23n) inside an SVG) is not a file either.
  if (NOT_LOCAL.test(v)) return null;
  return { path: v };
}

// Resolves a local reference against the folder of the file that names it. Returns { target } or { bad }.
function resolveFrom(fromDir, raw) {
  const lp = localPath(raw);
  if (!lp) return null;
  if (lp.bad) return { bad: lp.bad };
  if (lp.path.startsWith("/")) return { bad: "absolute path (must be relative so it works under /internships/)" };
  const target = path.posix.normalize(path.posix.join(fromDir, lp.path));
  if (target === ".." || target.startsWith("../") || path.posix.isAbsolute(target)) return { bad: "points outside the repo" };
  return { target };
}

const HTML_SELECTORS = [
  "script[src]", "img[src]", "source[src]", "iframe[src]", "link[href]", "a[href]",
  'meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[itemprop="image"]',
];

function htmlRefs(file) {
  const dom = new JSDOM(read(file));
  const doc = dom.window.document;
  const out = [];
  for (const el of doc.querySelectorAll(HTML_SELECTORS.join(","))) {
    if (el.matches("a[href]")) {
      // Links to other pages are not files this check owns. Only links to a non-HTML file (a PDF, a data file) count.
      const v = (el.getAttribute("href") || "").split(/[?#]/)[0];
      if (!v || v.endsWith("/") || /\.html?$/i.test(v) || !/\.[a-z0-9]+$/i.test(v)) continue;
    }
    const attr = el.matches("meta") ? "content" : el.matches("link[href], a[href]") ? "href" : "src";
    const raw = el.getAttribute(attr);
    if (raw) out.push(raw);
  }
  for (const el of doc.querySelectorAll("img[srcset], source[srcset]")) {
    for (const part of el.getAttribute("srcset").split(",")) out.push(part.trim().split(/\s+/)[0]);
  }
  dom.window.close();
  return out.map((raw) => ({ from: file, raw, res: resolveFrom(".", raw) })).filter((r) => r.res);
}

function cssRefs(file) {
  const dir = path.posix.dirname(file);
  const out = [];
  // Inline data: URIs are not files. Strip them first, since an SVG inside one can hold its own url(...).
  const css = read(file).replace(/url\(\s*(["'])data:[\s\S]*?\1\s*\)/g, "");
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    out.push({ from: file, raw: m[2], res: resolveFrom(dir, m[2]) });
  }
  return out.filter((r) => r.res);
}

function jsRefs(file) {
  const out = [];
  // Quoted string literals on one line (single, double or back quotes, no escapes or template pieces).
  for (const m of read(file).matchAll(/(["'`])([^"'`\\\n]{1,300})\1/g)) {
    if (!JS_FILE_LITERAL.test(m[2])) continue;
    out.push({ from: file, raw: m[2], res: resolveFrom(".", m[2]) });
  }
  return out;
}

const ALL_REFS = [
  ...ROOT_HTML.flatMap(htmlRefs),
  ...CSS_FILES.flatMap(cssRefs),
  ...JS_FILES.flatMap(jsRefs),
];

const describe = (r) => `${r.from}: "${r.raw}"`;

test("every local file named by a root page, stylesheet or script exists", () => {
  const problems = [];
  for (const r of ALL_REFS) {
    if (r.res.bad) problems.push(`${describe(r)} is not usable: ${r.res.bad}`);
    else if (!fs.existsSync(path.join(ROOT, r.res.target))) problems.push(`${describe(r)} points to ${r.res.target}, which does not exist`);
  }
  assert.deepEqual(problems, [], "a page, stylesheet or script names a file that is missing or unusable");
});

test("every file in assets/img, assets/qr and assets/fonts is named by something", () => {
  const referenced = new Set(ALL_REFS.filter((r) => r.res.target).map((r) => r.res.target));
  const allowed = new Map(ORPHAN_ALLOW.map((a) => [a.file, a.why]));
  const files = [];
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const next = rel + "/" + name.name;
      if (name.isDirectory()) walk(next);
      else files.push(next);
    }
  };
  for (const dir of ORPHAN_FOLDERS) walk(dir);
  const orphans = files.filter((f) => !referenced.has(f) && !allowed.has(f));
  assert.deepEqual(orphans, [], "these files are not named by any root page, stylesheet or script (delete them or reference them)");
  for (const f of allowed.keys()) {
    assert.ok(files.includes(f), `ORPHAN_ALLOW lists ${f}, which is not on disk; remove the entry`);
    assert.ok(!referenced.has(f), `ORPHAN_ALLOW lists ${f}, which is now referenced; remove the entry`);
  }
});

test("the scan sees the references it must check (guards against a scan that finds nothing)", () => {
  const targets = new Set(ALL_REFS.filter((r) => r.res.target).map((r) => r.res.target));
  for (const must of [
    "assets/img/og.jpg",
    "assets/img/favicon.svg",
    "apple-touch-icon.png",
    "favicon.ico",
    "assets/css/style.css",
    "assets/fonts/dm-sans-latin.woff2",
    "assets/fonts/permanent-marker-latin.woff2",
    "assets/img/swoosh.svg",
    "assets/qr/home.svg",
    "data/entries.json",
  ]) {
    assert.ok(targets.has(must), `the scan found no reference to ${must}`);
  }
  assert.ok(ALL_REFS.length > 100, `only ${ALL_REFS.length} references found; the patterns may be broken`);
});

test("query strings and hashes are stripped before the file is checked", () => {
  assert.deepEqual(localPath("assets/css/style.css?v=0eec40f9"), { path: "assets/css/style.css" });
  assert.deepEqual(localPath("assets/js/common.js?v=0eec40f9#x"), { path: "assets/js/common.js" });
  assert.equal(localPath("https://example.org/a.js"), null);
  assert.equal(localPath("data:image/svg+xml;utf8,<svg/>"), null);
  assert.equal(localPath("#top"), null);
  assert.equal(localPath("{{base}}assets/img/og.jpg"), null);
  assert.deepEqual(resolveFrom("assets/css", "../fonts/dm-sans-latin.woff2"), { target: "assets/fonts/dm-sans-latin.woff2" });
  assert.match(resolveFrom(".", "/assets/img/og.jpg").bad, /absolute/);
});
