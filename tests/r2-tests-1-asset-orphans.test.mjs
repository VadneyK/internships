// Two directions for the scripts and stylesheets, plus the data files the JavaScript fetches.
// Plain file reads and jsdom parsing (no page script runs, no network). Run with:
//   node --test tests/r2-tests-1-asset-orphans.test.mjs
//
// What it checks:
// - every <script src> and <link href> in every root *.html resolves to a file in the repo (a page names a missing file)
// - every assets/js/*.js is loaded by at least one root *.html (a script that no page loads is an orphan)
// - every quoted "data/....json" string literal in assets/js/*.js names a file that exists
// The complementary check for img, srcset, url(...) and the orphan folders lives in r1-tests-2-asset-refs.test.mjs.
// Query strings (?v=...) and hashes are stripped. A "/internships/" or https://vadneyk.github.io/internships/ prefix is
// removed first, since those addresses are the same files on the live site. Other web addresses and data: URIs are skipped.
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
const JS_FILES = listDir("assets/js", ".js").map((f) => "assets/js/" + f);

// Anything with a scheme (https:, data:, mailto:, tel:), a protocol-relative address or a bare fragment.
const NOT_LOCAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
const SITE_PREFIX = "https://vadneyk.github.io/internships/";
const SUBPATH_PREFIX = "/internships/";

// Turns one written reference into a repo-relative path, or null when it is not a local file.
function localPath(raw) {
  let v = String(raw || "").trim();
  if (v.startsWith(SITE_PREFIX)) v = v.slice(SITE_PREFIX.length);
  else if (v.startsWith(SUBPATH_PREFIX)) v = v.slice(SUBPATH_PREFIX.length);
  if (!v || NOT_LOCAL.test(v) || v.includes("{{") || v.includes("${")) return null;
  v = v.split("?")[0].split("#")[0];
  if (!v) return null;
  try { v = decodeURIComponent(v); } catch { return null; }
  return v;
}

// Resolves a local reference against the repo root (the pages sit at the root). Returns a repo-relative path or null.
function resolveTarget(raw) {
  const v = localPath(raw);
  if (!v) return null;
  if (v.startsWith("/")) return { bad: "absolute path (must be relative so it works under /internships/)" };
  const target = path.posix.normalize(v);
  if (target === ".." || target.startsWith("../") || path.posix.isAbsolute(target)) return { bad: "points outside the repo" };
  return { target };
}

// Every <script src> and <link href> in one root page, as { from, raw, target }.
function pageAssetRefs(file) {
  const dom = new JSDOM(read(file));
  const doc = dom.window.document;
  const out = [];
  for (const el of doc.querySelectorAll("script[src], link[href]")) {
    const raw = el.getAttribute(el.hasAttribute("src") ? "src" : "href");
    if (!raw) continue;
    const res = resolveTarget(raw);
    if (res) out.push({ from: file, raw, ...res });
  }
  dom.window.close();
  return out;
}

// Quoted "data/....json" literals in one script. Dynamic pieces (a path built with + or a template) are not literals,
// so a string such as "data/programs/" with no .json ending is skipped on purpose.
const DATA_JSON_LITERAL = /(["'`])(data\/[^"'`\\\s]*?\.json)(?:[?#][^"'`\\\s]*)?\1/g;
function scriptDataRefs(file) {
  const out = [];
  for (const m of read(file).matchAll(DATA_JSON_LITERAL)) {
    out.push({ from: file, raw: m[2], target: m[2] });
  }
  return out;
}

const PAGE_REFS = ROOT_HTML.flatMap(pageAssetRefs);
const DATA_REFS = JS_FILES.flatMap(scriptDataRefs);
const describe = (r) => `${r.from}: "${r.raw}"`;

test("every script src and link href in a root page resolves to a file that exists", () => {
  const problems = [];
  for (const r of PAGE_REFS) {
    if (r.bad) problems.push(`${describe(r)} is not usable: ${r.bad}`);
    else if (!fs.existsSync(path.join(ROOT, r.target))) problems.push(`${describe(r)} points to ${r.target}, which does not exist`);
  }
  assert.deepEqual(problems, [], "a root page names a script or stylesheet that is missing or unusable");
  assert.ok(PAGE_REFS.length > 20, `only ${PAGE_REFS.length} script and link references found; the scan may be broken`);
});

test("every assets/js/*.js is loaded by at least one root page", () => {
  const loaded = new Set(PAGE_REFS.filter((r) => !r.bad && r.target.startsWith("assets/js/")).map((r) => r.target));
  // es.js is loaded only by the Spanish pages in es/ (ADR 0008), which are not root pages.
  const esPages = fs.existsSync(path.join(ROOT, "es")) ? fs.readdirSync(path.join(ROOT, "es")).filter((f) => f.endsWith(".html")) : [];
  if (esPages.some((f) => fs.readFileSync(path.join(ROOT, "es", f), "utf8").includes('src="../assets/js/es.js'))) loaded.add("assets/js/es.js");
  const orphans = JS_FILES.filter((f) => !loaded.has(f));
  assert.deepEqual(orphans, [], "these scripts are not loaded by any root page (delete them or add the script tag)");
  assert.ok(JS_FILES.length > 0, "no files found in assets/js");
});

test("every quoted data/....json literal in assets/js points to a file that exists", () => {
  const problems = [];
  for (const r of DATA_REFS) {
    if (!fs.existsSync(path.join(ROOT, r.target))) problems.push(`${describe(r)} points to ${r.target}, which does not exist`);
  }
  assert.deepEqual(problems, [], "a script fetches a data file that is missing");
  assert.ok(DATA_REFS.length >= 10, `only ${DATA_REFS.length} data/*.json literals found; the pattern may be broken`);
});

test("the path helper strips prefixes, queries and hashes and skips outside addresses", () => {
  assert.equal(resolveTarget("assets/js/common.js?v=4270701f").target, "assets/js/common.js");
  assert.equal(resolveTarget("/internships/assets/js/common.js?v=4270701f").target, "assets/js/common.js");
  assert.equal(resolveTarget("https://vadneyk.github.io/internships/assets/css/style.css").target, "assets/css/style.css");
  assert.equal(resolveTarget("https://fonts.googleapis.com/css2?family=DM+Sans"), null);
  assert.equal(resolveTarget("data:image/svg+xml;utf8,<svg/>"), null);
  assert.equal(resolveTarget("#top"), null);
  assert.match(resolveTarget("/assets/js/lib.js").bad, /absolute/);
});
