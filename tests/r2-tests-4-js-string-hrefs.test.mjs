// Every relative page link written inside a JS string (assets/js/*.js) must point to a real built root page,
// and every #fragment on such a link must be an id in that page's html or an id the page's own scripts create.
// Rendered-link tests only see links drawn after one load path; this reads the source, so rare states are covered too.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS_DIR = path.join(ROOT, "assets", "js");
const read = (p) => fs.readFileSync(p, "utf8");

const pages = new Set(fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")));
const jsFiles = fs.readdirSync(JS_DIR).filter((f) => f.endsWith(".js"));

/* Known cases the scan cannot decide alone. Each needs a reason. */
const ALLOW_FILE = {
  "page.html": "parents.js comment text that explains the source format, not a link",
};
/* A fragment that ends in "-" is the start of an id built at run time (for example "p-" + program id).
   It passes when the page's scripts build ids from that prefix. */
const ALLOW_PREFIX = {
  "find.html#p-": "program cards get id=\"p-\" + the program id in find.js",
};
/* A fragment the page's own script reads as a parameter on load (page.html#name=value), not an anchor to an id.
   It passes while that script still reads the literal "#name=". Each needs a reason. */
const ALLOW_PARAM = {
  "find.html#saved": "find.js reads location.hash #saved=id1,id2 on load and offers those programs (keep my list, docs/adr/0008)",
};
/* Fragments added to a link in a later string piece, so the first scan cannot see them. Each must still be in the source. */
const EXTRA_LINKS = [
  { file: "jobs.js", href: "interview.html#availability", needle: '"#availability"', reason: "jobs.js adds the fragment after the query string" },
];

function stripQuotesEscapes(s) { return s.replace(/\\"/g, '"'); }

function pageScripts(page) {
  const html = read(path.join(ROOT, page));
  return [...html.matchAll(/<script[^>]+src="assets\/js\/([\w.-]+\.js)/g)].map((m) => m[1]);
}
function idsIn(text) {
  const ids = new Set();
  const t = stripQuotesEscapes(text);
  for (const m of t.matchAll(/\bid\s*=\s*["']([\w-]+)["']/g)) ids.add(m[1]);
  for (const m of t.matchAll(/\.id\s*=\s*["']([\w-]+)["']/g)) ids.add(m[1]);
  for (const m of t.matchAll(/setAttribute\(\s*["']id["']\s*,\s*["']([\w-]+)["']/g)) ids.add(m[1]);
  for (const m of t.matchAll(/\bid\s*:\s*["']([\w-]+)["']/g)) ids.add(m[1]);
  return ids;
}
function scriptSource(page) {
  return pageScripts(page).map((f) => read(path.join(JS_DIR, f))).join("\n");
}

const found = []; // { file, page, frag }
for (const f of jsFiles) {
  const src = stripQuotesEscapes(read(path.join(JS_DIR, f)));
  for (const m of src.matchAll(/([A-Za-z0-9_\/.-]*[A-Za-z0-9_])\.html(?:\?[^"'#\s<>]*)?(?:#([A-Za-z0-9_-]+))?/g)) {
    const before = m[1];
    if (before.includes("/")) continue; // a full address in printed text, for example vadneyk.github.io/internships/permit.html
    found.push({ file: f, page: before + ".html", frag: m[2] || "" });
  }
}
for (const e of EXTRA_LINKS) {
  const [pg, frag] = e.href.split("#");
  found.push({ file: e.file, page: pg, frag, extra: e });
}

test("the scan finds links (guards against a regex that matches nothing)", () => {
  assert.ok(found.length > 40, "found only " + found.length);
  const pagesSeen = new Set(found.map((x) => x.page));
  for (const p of ["permit.html", "find.html", "jobs.html", "interview.html", "states.html"]) assert.ok(pagesSeen.has(p), p + " not seen");
});

test("every extra link's source text is still present", () => {
  for (const e of EXTRA_LINKS) assert.ok(read(path.join(JS_DIR, e.file)).includes(e.needle), e.file + " no longer has " + e.needle + ": " + e.reason);
});

test("every page link in an assets/js string points to a built root page", () => {
  const bad = [];
  for (const x of found) {
    if (ALLOW_FILE[x.page]) continue;
    if (!pages.has(x.page)) bad.push(x.file + " -> " + x.page);
  }
  assert.deepEqual([...new Set(bad)], []);
});

test("every #fragment on such a link is an id in the page html or built by the page's scripts", () => {
  const bad = [];
  for (const x of found) {
    if (!x.frag || ALLOW_FILE[x.page] || !pages.has(x.page)) continue;
    const html = stripQuotesEscapes(read(path.join(ROOT, x.page)));
    const ids = new Set([...idsIn(html), ...idsIn(scriptSource(x.page))]);
    if (x.frag.endsWith("-")) {
      const key = x.page + "#" + x.frag;
      if (!ALLOW_PREFIX[key]) { bad.push(x.file + " -> " + key + " (dynamic fragment not in allow-list)"); continue; }
      const src = scriptSource(x.page);
      if (!(src.includes('"' + x.frag + '"') || src.includes('id="' + x.frag))) bad.push(key + " allow-list reason no longer true: " + ALLOW_PREFIX[key]);
      continue;
    }
    if (ALLOW_PARAM[x.page + "#" + x.frag]) {
      if (!scriptSource(x.page).includes('"#' + x.frag + '="')) bad.push(x.page + "#" + x.frag + " allow-list reason no longer true: " + ALLOW_PARAM[x.page + "#" + x.frag]);
      continue;
    }
    if (!ids.has(x.frag)) bad.push(x.file + " -> " + x.page + "#" + x.frag);
  }
  assert.deepEqual([...new Set(bad)], []);
});
