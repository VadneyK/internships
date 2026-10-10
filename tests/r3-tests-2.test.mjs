// No-tracking guard: nothing loads from a third party in the built pages, the source templates, the CSS or the JS.
// Plain file reads and regular expressions, no browser. Run with: node --test tests/r3-tests-2.test.mjs
//
// Scans root *.html, src/*.html, assets/css/*.css and assets/js/*.js. The inline <script> bodies in the HTML are
// scanned with the JS rules too. Fails on:
// - html: a src, href, action, srcset, data or poster on a load or send tag (link, img, iframe, frame, source, video,
//   audio, embed, object, form, script, input, image, use, track, base) that is not relative and not on
//   https://vadneyk.github.io/internships/. A link whose rel is only canonical or alternate is exempt.
// - html: an on* handler that contains http, and a meta http-equiv=refresh.
// - css: @import, and url() that starts with http, https or //.
// - js: new Image(, createElement of script, img, iframe or link, import(, document.write, eval(, new Function(,
//   sendBeacon, navigator.geolocation, indexedDB.open. Also a load tag written inside a string, and a .src, .srcset,
//   .action or .poster assignment or setAttribute with a URL that is not relative. A URL built in code cannot be
//   checked, so it fails too. If it is a real and needed hit, add an ALLOWLIST entry with a one line reason.
//
// Known hits: none today, so ALLOWLIST is empty. A real hit that cannot be removed in the change goes in ALLOWLIST
// with the file, check and exact text. Any other hit fails. An entry that no longer matches a real hit also fails,
// so it gets removed once the source is fixed.
//
// Beyond the ticket's tag list, this test also checks: the extra tags listed above, poster, the JS string-tag scan,
// the .src/.srcset/.action/.poster assignments, setAttribute, and inline script bodies in the HTML.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (abs) => path.relative(ROOT, abs);
const listFiles = (dir, ext) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => path.join(ROOT, dir, f));

const ROOT_HTML = listFiles(".", ".html");
const SRC_HTML = listFiles("src", ".html");
const CSS_FILES = listFiles("assets/css", ".css");
const JS_FILES = listFiles("assets/js", ".js");

const OWN = "https://vadneyk.github.io/internships/";

// Known real hits. Each entry matches on file, check and the exact offending text. None are needed today.
const ALLOWLIST = [
  // { file: "example.html", check: "html-url", text: "https://...", reason: "one line why" },
];

// ---------- check ids ----------

const CHECK_HTML_URL = "html-url";
const CHECK_META_REFRESH = "html-meta-refresh";
const CHECK_ON_HANDLER = "html-on-handler";
const CHECK_CSS_IMPORT = "css-import";
const CHECK_CSS_URL = "css-url";
const CHECK_JS_TAG_URL = "js-tag-url";
const CHECK_JS_URL = "js-url";

const DYNAMIC_HINT = "cannot be checked. If it is a real and needed hit, add an ALLOWLIST entry with a one line reason";

// ---------- helpers ----------

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const finding = (line, check, text, detail) => ({ line, check, text: String(text), detail });

// Tags that load or send data from a URL in their attributes. The ticket names the first nine.
const URL_TAGS = new Set([
  "link", "img", "iframe", "frame", "source", "video", "audio", "embed", "object", "form",
  "script", "input", "image", "use", "track", "base",
]);
const URL_ATTRS = ["src", "href", "action", "srcset", "data", "poster"];

// A tag and its attribute text. Quoted values may hold ">" and are kept whole.
const TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

// Attribute names in a JS string tag. The lookbehind keeps data-src and data-href out of scope.
const ATTR_OPEN_JS = /(?<![\w-])(src|srcset|href|action|data|poster|rel)\s*=\s*\\?(["'])/gi;
const JS_TAG_RE = /<(link|img|iframe|frame|source|video|audio|embed|object|form|script|input|image|use|track|base)\b([^>]{0,300})/gi;
const JS_PROP_RE = /\.(src|srcset|action|poster)\s*=(?!=)/gi;
const JS_SETATTR_RE = /setAttribute\s*\(\s*(["'])(src|srcset|action|poster|data)\1\s*,\s*/gi;
const INLINE_SCRIPT_RE = /(<script\b(?![^>]*\bsrc\s*=)[^>]*>)([\s\S]*?)<\/script\s*>/gi;

// True when the URL stays on this site or is a relative path. Anything with a scheme, or starting with // or \, is not.
function isLocalUrl(raw) {
  const v = String(raw).trim();
  if (v.startsWith(OWN)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false;
  if (/^[\\/]{2}/.test(v) || v.startsWith("\\")) return false;
  return true;
}

// A link is exempt only when every rel token is canonical or alternate.
function isExemptLink(rel) {
  const tokens = String(rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => t === "canonical" || t === "alternate");
}

// The candidate URLs in a srcset value.
const srcsetUrls = (s) => String(s).split(",").map((c) => c.trim().split(/\s+/)[0]).filter(Boolean);

// Returns a Map of attribute name to value for one tag's attribute text. The first occurrence wins, as in HTML.
function parseAttrs(attrText) {
  const out = new Map();
  for (const m of attrText.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

// For a JS string tag: each URL-ish attribute with its literal value, or value null when it is built in code.
function attrValues(attrText) {
  const out = [];
  for (const m of attrText.matchAll(ATTR_OPEN_JS)) {
    const rest = attrText.slice(m.index + m[0].length);
    const lit = rest.match(new RegExp(`^([^"'\\\\]*)\\\\?${m[2]}`));
    out.push({ name: m[1].toLowerCase(), value: lit ? lit[1] : null });
  }
  return out;
}

// ---------- rules ----------

function htmlFindings(text) {
  const out = [];
  for (const m of text.matchAll(TAG_RE)) {
    const tag = m[1].toLowerCase();
    const line = lineOf(text, m.index);
    const attrs = parseAttrs(m[2]);
    if (tag === "meta" && (attrs.get("http-equiv") ?? "").trim().toLowerCase() === "refresh") {
      out.push(finding(line, CHECK_META_REFRESH, m[0], "meta refresh can send the browser to another site"));
    }
    for (const [name, value] of attrs) {
      if (name.startsWith("on") && /http/i.test(value)) {
        out.push(finding(line, CHECK_ON_HANDLER, value, `inline ${name} handler contains http`));
      }
    }
    if (!URL_TAGS.has(tag)) continue;
    if (tag === "link" && isExemptLink(attrs.get("rel"))) continue;
    for (const name of URL_ATTRS) {
      if (!attrs.has(name)) continue;
      const values = name === "srcset" ? srcsetUrls(attrs.get(name)) : [attrs.get(name)];
      for (const u of values) {
        if (!isLocalUrl(u)) out.push(finding(line, CHECK_HTML_URL, u, `<${tag} ${name}> loads or sends from another site`));
      }
    }
  }
  return out;
}

// Runs the JS rules on each inline script body in an HTML file. Lines are reported against the whole file.
function inlineScriptFindings(text) {
  const out = [];
  for (const m of text.matchAll(INLINE_SCRIPT_RE)) {
    const base = lineOf(text, m.index + m[1].length) - 1;
    for (const f of jsFindings(m[2])) out.push({ ...f, line: base + f.line });
  }
  return out;
}

function cssFindings(text) {
  const out = [];
  for (const m of text.matchAll(/@import\b/gi)) {
    out.push(finding(lineOf(text, m.index), CHECK_CSS_IMPORT, m[0], "@import loads another stylesheet"));
  }
  for (const m of text.matchAll(/url\(\s*["']?\s*(?:https?:|\/\/)[^)]*/gi)) {
    out.push(finding(lineOf(text, m.index), CHECK_CSS_URL, m[0], "url() loads from another site"));
  }
  return out;
}

// One entry per banned call. The check id is the text shown in ALLOWLIST entries.
const JS_BANNED = [
  { check: "new Image(", re: /\bnew\s+Image\s*\(/g, why: "loads a picture as soon as it is set" },
  { check: "createElement script/img/iframe/link", re: /createElement\s*\(\s*["'`](?:script|img|iframe|link)["'`]/gi, why: "creates an element that loads a file" },
  { check: "import(", re: /(?<![\w.$])import\s*\(/g, why: "loads code by URL" },
  { check: "document.write", re: /\bdocument\s*\.\s*write(?:ln)?\s*\(/g, why: "writes raw HTML into the page" },
  { check: "eval(", re: /(?<![\w.$])eval\s*\(/g, why: "runs a string as code" },
  { check: "new Function(", re: /\bnew\s+Function\s*\(/g, why: "runs a string as code" },
  { check: "sendBeacon", re: /\bsendBeacon\b/g, why: "sends data to a server" },
  { check: "navigator.geolocation", re: /\bnavigator\s*\.\s*geolocation\b/g, why: "reads where the teen is" },
  { check: "indexedDB.open", re: /\bindexedDB\s*\.\s*open\b/g, why: "keeps a database in the browser, which the no-tracking plan does not allow" },
];

// Checks the start of a URL expression. A quoted literal is judged by its text. Anything else is built in code.
function exprFinding(expr, line, check, label) {
  const lit = expr.match(/^\s*(["'`])([^"'`\n]*)\1/);
  if (lit) return isLocalUrl(lit[2]) ? null : finding(line, check, lit[2], `${label} is not a relative URL`);
  return finding(line, check, expr.trim().slice(0, 60), `${label} URL ${DYNAMIC_HINT}`);
}

function jsFindings(text) {
  const out = [];
  for (const b of JS_BANNED) {
    for (const m of text.matchAll(b.re)) out.push(finding(lineOf(text, m.index), b.check, m[0], b.why));
  }
  for (const m of text.matchAll(JS_TAG_RE)) {
    const tag = m[1].toLowerCase();
    const line = lineOf(text, m.index);
    const vals = attrValues(m[2]);
    const rel = vals.find((v) => v.name === "rel");
    if (tag === "link" && rel && isExemptLink(rel.value)) continue;
    for (const v of vals) {
      if (v.name === "rel") continue;
      if (v.value === null) {
        out.push(finding(line, CHECK_JS_TAG_URL, `<${tag} ${v.name}>`, `<${tag} ${v.name}> in a string: URL ${DYNAMIC_HINT}`));
        continue;
      }
      const values = v.name === "srcset" ? srcsetUrls(v.value) : [v.value];
      for (const u of values) {
        if (!isLocalUrl(u)) out.push(finding(line, CHECK_JS_TAG_URL, u, `<${tag} ${v.name}> in a string loads or sends from another site`));
      }
    }
  }
  for (const m of text.matchAll(JS_PROP_RE)) {
    const start = m.index + m[0].length;
    const expr = text.slice(start, start + 200).split(/[;\n]/)[0];
    const f = exprFinding(expr, lineOf(text, m.index), CHECK_JS_URL, `.${m[1]} =`);
    if (f) out.push(f);
  }
  for (const m of text.matchAll(JS_SETATTR_RE)) {
    const start = m.index + m[0].length;
    const expr = text.slice(start, start + 200).split(/[;\n]/)[0];
    const f = exprFinding(expr, lineOf(text, m.index), CHECK_JS_URL, `setAttribute("${m[2]}")`);
    if (f) out.push(f);
  }
  return out;
}

const scanners = {
  html: (t) => htmlFindings(t).concat(inlineScriptFindings(t)),
  css: cssFindings,
  js: jsFindings,
};

function scan(files, fn) {
  const out = [];
  for (const file of files) {
    for (const f of fn(fs.readFileSync(file, "utf8"))) out.push({ ...f, file: rel(file) });
  }
  return out;
}

const isAllowed = (f) => ALLOWLIST.some((a) => a.file === f.file && a.check === f.check && a.text === f.text);
const describe = (f) => `${f.file} line ${f.line}: ${f.detail} [${f.check}] ${JSON.stringify(f.text.slice(0, 100))}`;

// ---------- seeded fixtures: each bad one must raise its own check id; each good one must raise nothing ----------

const BAD = [
  // html: one per attribute, plus each extra tag and the rel and meta and on* rules
  { kind: "html", check: CHECK_HTML_URL, s: '<img src="https://tracker.example.org/p.gif" alt="">' },
  { kind: "html", check: CHECK_HTML_URL, s: '<a href="x"><link rel="stylesheet" href="https://fonts.example.org/x.css"></a>' },
  { kind: "html", check: CHECK_HTML_URL, s: '<link rel="preload" href="https://cdn.example.org/f.woff2" as="font">' },
  { kind: "html", check: CHECK_HTML_URL, s: '<link rel="stylesheet" href="//fonts.example.org/x.css">' },
  { kind: "html", check: CHECK_HTML_URL, s: '<form action="https://collect.example.org/s" method="post"></form>' },
  { kind: "html", check: CHECK_HTML_URL, s: '<img srcset="a.png 1x, https://cdn.example.org/b.png 2x" src="a.png" alt="">' },
  { kind: "html", check: CHECK_HTML_URL, s: '<object data="https://x.example.org/o.swf"></object>' },
  { kind: "html", check: CHECK_HTML_URL, s: '<video poster="https://cdn.example.org/p.jpg"></video>' },
  { kind: "html", check: CHECK_HTML_URL, s: '<iframe src="https://video.example.org/embed"></iframe>' },
  { kind: "html", check: CHECK_HTML_URL, s: '<source src="https://cdn.example.org/a.mp3">' },
  { kind: "html", check: CHECK_HTML_URL, s: '<embed src="https://x.example.org/e.pdf">' },
  { kind: "html", check: CHECK_HTML_URL, s: '<script src="https://cdn.example.org/lib.js"></script>' },
  { kind: "html", check: CHECK_META_REFRESH, s: '<meta http-equiv="refresh" content="0; url=index.html">' },
  { kind: "html", check: CHECK_ON_HANDLER, s: '<button onclick="new Image().src=\'https://t.example.org/p.gif\'">Go</button>' },
  { kind: "html", check: CHECK_JS_URL, s: '<script>img.src = "https://t.example.org/p.gif";</script>' },
  // css
  { kind: "css", check: CHECK_CSS_IMPORT, s: '@import url("https://fonts.example.org/css?family=X");' },
  { kind: "css", check: CHECK_CSS_URL, s: ".a { background: url(http://tracker.example.org/p.png); }" },
  { kind: "css", check: CHECK_CSS_URL, s: '.b { background: url("//cdn.example.org/x.png"); }' },
  // js: one per banned call
  { kind: "js", check: "new Image(", s: "var i = new Image();" },
  { kind: "js", check: "createElement script/img/iframe/link", s: 'var s = document.createElement("script");' },
  { kind: "js", check: "createElement script/img/iframe/link", s: "var f = document.createElement('iframe');" },
  { kind: "js", check: "import(", s: 'var m = import("https://x.example.org/m.js");' },
  { kind: "js", check: "document.write", s: 'document.write("<p>hi</p>");' },
  { kind: "js", check: "eval(", s: 'var v = eval("1 + 1");' },
  { kind: "js", check: "new Function(", s: 'var f = new Function("return 1");' },
  { kind: "js", check: "sendBeacon", s: 'navigator.sendBeacon("https://x.example.org/c", "d");' },
  { kind: "js", check: "navigator.geolocation", s: "navigator.geolocation.getCurrentPosition(function () {});" },
  { kind: "js", check: "indexedDB.open", s: 'var db = indexedDB.open("teen-data", 1);' },
  // js: load tags written inside a string
  { kind: "js", check: CHECK_JS_TAG_URL, s: `el.innerHTML = '<img src="https://t.example.org/p.gif" alt="">';` },
  { kind: "js", check: CHECK_JS_TAG_URL, s: `el.innerHTML = '<form action="https://collect.example.org/s"></form>';` },
  { kind: "js", check: CHECK_JS_TAG_URL, s: `el.innerHTML = '<video poster="https://cdn.example.org/p.jpg"></video>';` },
  { kind: "js", check: CHECK_JS_TAG_URL, s: `el.innerHTML = '<img src="' + url + '" alt="">';` },
  // js: property and setAttribute assignments
  { kind: "js", check: CHECK_JS_URL, s: 'img.src = "https://t.example.org/p.gif";' },
  { kind: "js", check: CHECK_JS_URL, s: "img.src = url;" },
  { kind: "js", check: CHECK_JS_URL, s: 'el.setAttribute("src", "https://t.example.org/p.gif");' },
  { kind: "js", check: CHECK_JS_URL, s: "el.setAttribute('action', url);" },
];

const GOOD = [
  // html
  { kind: "html", s: '<img src="assets/img/swoosh.svg" alt="" width="600" height="60">' },
  { kind: "html", s: '<img src="https://vadneyk.github.io/internships/assets/img/og.jpg" alt="">' },
  { kind: "html", s: '<link rel="canonical" href="https://elsewhere.example.org/page.html">' },
  { kind: "html", s: '<link rel="alternate" hreflang="en" href="https://elsewhere.example.org/">' },
  { kind: "html", s: '<link rel="preload" href="assets/fonts/dm-sans-latin.woff2" as="font" type="font/woff2" crossorigin>' },
  { kind: "html", s: '<form class="card" onsubmit="return false"></form>' },
  { kind: "html", s: '<a href="https://github.com/VadneyK/internships">Code</a>' },
  { kind: "html", s: '<img srcset="assets/img/a.png 1x, assets/img/a@2x.png 2x" src="assets/img/a.png" alt="">' },
  { kind: "html", s: '<img data-src="https://x.example.org/lazy.png" src="assets/img/a.png" alt="">' },
  { kind: "html", s: '<meta property="og:image" content="https://vadneyk.github.io/internships/assets/img/og.jpg">' },
  { kind: "html", s: '<script src="assets/js/common.js?v=9b5f189f"></script>' },
  { kind: "html", s: '<script>var t = localStorage.getItem("theme");</script>' },
  // css
  { kind: "css", s: `.c { background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>"); }` },
  { kind: "css", s: "@font-face { font-family: X; src: url(../fonts/dm-sans-latin.woff2) format('woff2'); }" },
  { kind: "css", s: ".d { background: url(assets/img/swoosh.svg); }" },
  // js
  { kind: "js", s: 'fetch("data/entries.json", { cache: "no-cache" });' },
  { kind: "js", s: 'var a = document.createElement("a"); a.href = "https://github.com/VadneyK/internships";' },
  { kind: "js", s: `el.innerHTML = '<a href="https://github.com/VadneyK/internships/issues/1">Issue 1</a>';` },
  { kind: "js", s: `el.innerHTML = '<img src="assets/img/swoosh.svg" alt="">';` },
  { kind: "js", s: `el.innerHTML = '<img data-src="https://x.example.org/a.png" alt="">';` },
  { kind: "js", s: `el.innerHTML = '<link rel="canonical" href="https://elsewhere.example.org/">';` },
  { kind: "js", s: "var r = retrieval(1); var x = new Imagery(2);" },
  { kind: "js", s: 'img.src = "assets/img/swoosh.svg";' },
  { kind: "js", s: 'el.setAttribute("data-val", "x");' },
  { kind: "js", s: "var y = i<input.length;" },
];

// ---------- tests ----------

test("the checks are not vacuous: each bad fixture raises its own check id and each good fixture raises nothing", () => {
  for (const c of BAD) {
    const found = scanners[c.kind](c.s);
    assert.ok(
      found.some((f) => f.check === c.check),
      `bad ${c.kind} fixture missed check "${c.check}": ${c.s}`,
    );
  }
  for (const g of GOOD) {
    const found = scanners[g.kind](g.s);
    assert.deepEqual(found.map((f) => f.check), [], `good ${g.kind} fixture was flagged: ${g.s}`);
  }
});

test("root *.html and src/*.html: no third-party load, no meta refresh, no http inline handler", () => {
  assert.ok(ROOT_HTML.length > 0 && SRC_HTML.length > 0, "no html files found");
  const found = scan([...ROOT_HTML, ...SRC_HTML], scanners.html).filter((f) => !isAllowed(f));
  assert.deepEqual(found.map(describe), []);
});

test("assets/css/*.css: no @import and no url() that loads from another site", () => {
  assert.ok(CSS_FILES.length > 0, "no assets/css/*.css files found");
  const found = scan(CSS_FILES, scanners.css).filter((f) => !isAllowed(f));
  assert.deepEqual(found.map(describe), []);
});

test("assets/js/*.js: no banned browser call and no load tag or URL that points off site", () => {
  assert.ok(JS_FILES.length > 0, "no assets/js/*.js files found");
  const found = scan(JS_FILES, scanners.js).filter((f) => !isAllowed(f));
  assert.deepEqual(found.map(describe), []);
});

test("inline script bodies in the HTML: no banned browser call and no load tag or URL that points off site", () => {
  const files = [...ROOT_HTML, ...SRC_HTML];
  const found = scan(files, inlineScriptFindings).filter((f) => !isAllowed(f));
  assert.deepEqual(found.map(describe), []);
});

test("every ALLOWLIST entry still matches a real finding (remove stale entries)", () => {
  const all = [
    ...scan([...ROOT_HTML, ...SRC_HTML], scanners.html),
    ...scan(CSS_FILES, scanners.css),
    ...scan(JS_FILES, scanners.js),
  ];
  const stale = ALLOWLIST
    .filter((a) => !all.some((f) => f.file === a.file && f.check === a.check && f.text === a.text))
    .map((a) => `${a.file} [${a.check}] ${a.text}`);
  assert.deepEqual(stale, []);
});
