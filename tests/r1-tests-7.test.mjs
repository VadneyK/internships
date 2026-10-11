// Static text and URL hygiene for data/*.json, src/*.html, root *.html and assets/js/*.js.
// Plain file reads and regular expressions, no browser. Run with: node --test tests/r1-tests-7.test.mjs
//
// The site has no build-time check for text that is only in hand-edited data or source templates, so this file
// walks every string in data/*.json and fails on: an em dash or en dash, a plain http:// link, a placeholder word
// (TODO, TBD, lorem, FIXME, undefined, {{), a url field that is not a valid absolute https URL, a script src that is
// not a relative assets/js path, and in assets/js any fetch, XMLHttpRequest.open, navigator.sendBeacon or WebSocket
// call to a non-relative URL, or any write to document.cookie.
//
// Known hits: the test is not weakened. A real hit that cannot be fixed in this change is listed in KNOWN_HITS with
// the reason. Any other hit still fails. An entry that no longer matches a real hit also fails, so it gets removed
// once the source is fixed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (abs) => path.relative(ROOT, abs);
const listFiles = (dir, ext) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => path.join(ROOT, dir, f));

const DATA_FILES = listFiles("data", ".json");
const SRC_HTML = listFiles("src", ".html");
const ROOT_HTML = listFiles(".", ".html");
const JS_FILES = listFiles("assets/js", ".js");

// The five data files whose url fields are links a teen can tap.
const URL_FILES = ["transit.json", "languages.json", "interview.json", "permits.json", "younger.json", "safety.json"];

// Known real hits. Each one matches on exact file, check and text.
const KNOWN_HITS = [
  {
    // Source: data/programs/indiana-dwd-workone-young-adult-services.json, sources_fetched list.
    // Fix the program file to https, run tools/build_data.py, then delete this entry.
    file: "data/entries.json",
    check: "http",
    text: "http://www.workonewestcentral.org/60.html",
  },
];

// ---------- helpers (pure, so the seeded test can exercise them) ----------

const DASH = /[\u2013\u2014]/;
const PLAIN_HTTP = /http:\/\//i;
// Upper case only, so the Spanish word "todo" in languages.json is not a hit.
const PLACEHOLDER_UPPER = /\b(?:TODO|TBD|FIXME)\b/;
const PLACEHOLDER_ANY_CASE = /\b(?:lorem|undefined)\b|\{\{/i;

// One finding per check kind for a single string.
function textFindings(text) {
  const out = [];
  if (DASH.test(text)) out.push({ check: "dash", detail: "em dash or en dash (use a comma, period or colon)" });
  if (PLAIN_HTTP.test(text)) out.push({ check: "http", detail: "plain http:// link (https only)" });
  const ph = text.match(PLACEHOLDER_UPPER) || text.match(PLACEHOLDER_ANY_CASE);
  if (ph) out.push({ check: "placeholder", detail: `placeholder word "${ph[0]}"` });
  return out;
}

function isHttpsUrl(s) {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

// Calls visit(text, where) for every string (values and object keys) and onProp(key, value, where) for every
// object property. where is a JSON path such as $.questions[0].url.
function walkJson(value, where, onString, onProp) {
  if (typeof value === "string") { onString(value, where); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => walkJson(v, `${where}[${i}]`, onString, onProp)); return; }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      onString(k, `${where}.${k} (key)`);
      if (onProp) onProp(k, v, `${where}.${k}`);
      walkJson(v, `${where}.${k}`, onString, onProp);
    }
  }
}

const SCRIPT_TAG = /<script\b([^>]*)>/gi;
const SRC_ATTR = /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const LOCAL_JS = /^assets\/js\/[A-Za-z0-9._-]+\.js$/;

// Returns one problem string per <script src> that is not a relative assets/js path.
function scriptProblems(html) {
  const out = [];
  for (const tag of html.matchAll(SCRIPT_TAG)) {
    const m = tag[1].match(SRC_ATTR);
    if (!m) continue;
    const src = m[1] ?? m[2] ?? m[3];
    const line = html.slice(0, tag.index).split("\n").length;
    if (!LOCAL_JS.test(src.split(/[?#]/)[0])) out.push(`line ${line}: <script src="${src}"> is not a relative assets/js path`);
  }
  return out;
}

// Source text of argument n (0-based) of the call whose "(" is at index open. Null if there is no such argument.
function callArg(src, open, n) {
  let depth = 0;
  let index = 0;
  let cur = "";
  let quote = null;
  for (let i = open + 1; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      cur += c;
      if (c === "\\") { cur += src[i + 1] ?? ""; i++; } else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; cur += c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; }
    else if (c === "," && depth === 0) {
      if (index === n) return cur.trim();
      index++;
      cur = "";
      continue;
    }
    cur += c;
  }
  return index === n ? cur.trim() : null;
}

// Returns a problem string when the URL expression is not a relative plain string literal, else null.
function urlProblem(expr) {
  // A relative literal prefix plus an encoded id, for example "data/programs/" + encodeURIComponent(id) + ".json", is safe: the host cannot change.
  const pre = expr.match(/^(["'])([^"'\\]*)\1\s*\+\s*encodeURIComponent\s*\(/);
  if (pre) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(pre[2]) || /^[\\/]{2}/.test(pre[2]) || !pre[2]) return `URL "${pre[2]}" is not relative`;
    return null;
  }
  const m = expr.match(/^(["'`])([\s\S]*)\1$/);
  if (!m || m[2].includes(m[1])) return `URL ${expr.slice(0, 60)} is not a plain string literal, so it cannot be checked`;
  let text = m[2];
  if (m[1] === "`") {
    const at = text.indexOf("${");
    if (at === 0) return "URL starts with an expression, so it cannot be checked";
    if (at > 0) text = text.slice(0, at);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || /^[\\/]{2}/.test(text)) return `URL "${text}" is not relative`;
  return null;
}

const FETCH_LIKE = [
  { label: "fetch", re: /\bfetch\s*\(/g, n: 0 },
  { label: "navigator.sendBeacon", re: /\bsendBeacon\s*\(/g, n: 0 },
  { label: "WebSocket", re: /\bWebSocket\s*\(/g, n: 0 },
];
const XHR_OPEN = /\.open\s*\(/g;
const COOKIE_WRITE = /document\s*(?:\.\s*cookie|\[\s*["']cookie["']\s*\])\s*\+?=(?!=)/g;

// Returns one problem string per network call with a non-relative or unreadable URL, and per cookie write.
function jsProblems(src) {
  const where = (i) => `line ${src.slice(0, i).split("\n").length}`;
  const sites = [];
  for (const c of FETCH_LIKE) {
    for (const m of src.matchAll(c.re)) sites.push({ label: c.label, at: m.index, open: m.index + m[0].length - 1, n: c.n });
  }
  if (/\bXMLHttpRequest\b/.test(src)) {
    for (const m of src.matchAll(XHR_OPEN)) sites.push({ label: "XMLHttpRequest.open", at: m.index, open: m.index + m[0].length - 1, n: 1 });
  }
  const out = [];
  for (const s of sites) {
    const expr = callArg(src, s.open, s.n);
    if (expr === null) continue;
    const why = urlProblem(expr);
    if (why) out.push(`${s.label} at ${where(s.at)}: ${why}`);
  }
  for (const m of src.matchAll(COOKIE_WRITE)) out.push(`document.cookie write at ${where(m.index)}`);
  return out;
}

function dataFindings() {
  const out = [];
  for (const file of DATA_FILES) {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    walkJson(json, "$", (text, where) => {
      for (const f of textFindings(text)) out.push({ file: rel(file), where, check: f.check, detail: f.detail, text });
    });
  }
  return out;
}

const isKnown = (h) => KNOWN_HITS.some((k) => k.file === h.file && k.check === h.check && k.text === h.text);

// ---------- tests ----------

test("the checks are not vacuous: seeded bad input is caught and good input passes", () => {
  assert.ok(textFindings("a \u2014 b").some((f) => f.check === "dash"));
  assert.ok(textFindings("a \u2013 b").some((f) => f.check === "dash"));
  assert.ok(textFindings("see http://example.org").some((f) => f.check === "http"));
  assert.ok(textFindings("Fee TBD").some((f) => f.check === "placeholder"));
  assert.ok(textFindings("{{count}} programs").some((f) => f.check === "placeholder"));
  assert.ok(textFindings("lorem ipsum").some((f) => f.check === "placeholder"));
  assert.deepEqual(textFindings("Plain text with https://example.org only."), []);
  assert.deepEqual(textFindings("Todo es bueno para ti."), []);

  assert.equal(isHttpsUrl("http://example.org"), false);
  assert.equal(isHttpsUrl("/relative/path"), false);
  assert.equal(isHttpsUrl("https://example.org/x"), true);

  assert.equal(scriptProblems('<script src="https://cdn.example.org/x.js"></script>').length, 1);
  assert.equal(scriptProblems('<script src="../assets/js/x.js"></script>').length, 1);
  assert.deepEqual(scriptProblems('<script src="assets/js/common.js?v={{ver}}"></script>'), []);

  assert.equal(jsProblems('fetch("https://example.org/x")').length, 1);
  assert.equal(jsProblems("navigator.sendBeacon(u, d)").length, 1);
  assert.equal(jsProblems('new WebSocket("wss://example.org")').length, 1);
  assert.equal(jsProblems('var x = new XMLHttpRequest(); x.open("GET", "https://example.org/x");').length, 1);
  assert.equal(jsProblems('document.cookie = "a=b"').length, 1);
  assert.deepEqual(jsProblems('fetch("data/entries.json", { cache: "no-cache" });'), []);
  assert.deepEqual(jsProblems('var x = new XMLHttpRequest(); x.open("GET", "data/a.json"); var c = document.cookie;'), []);
});

test("data/*.json: every string is free of em or en dashes, plain http:// links and placeholder words", () => {
  assert.ok(DATA_FILES.length > 0, "no data/*.json files found");
  const problems = dataFindings()
    .filter((h) => !isKnown(h))
    .map((h) => `${h.file} ${h.where}: ${h.detail}`);
  assert.deepEqual(problems, []);
});

test("src/*.html and assets/js/*.js: no em or en dash characters and no plain http:// links, anywhere in the text", () => {
  const problems = [];
  for (const file of [...SRC_HTML, ...JS_FILES]) {
    fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (DASH.test(line)) problems.push(`${rel(file)} line ${i + 1}: em dash or en dash (use a comma, period or colon)`);
      if (PLAIN_HTTP.test(line)) problems.push(`${rel(file)} line ${i + 1}: plain http:// link (https only)`);
    });
  }
  assert.deepEqual(problems, []);
});

test("data/*.json: every KNOWN_HITS entry still matches a real hit (remove stale entries)", () => {
  const hits = dataFindings();
  const stale = KNOWN_HITS
    .filter((k) => !hits.some((h) => h.file === k.file && h.check === k.check && h.text === k.text))
    .map((k) => `${k.file} [${k.check}] ${k.text}`);
  assert.deepEqual(stale, []);
});

test("transit, languages, interview, permits and younger: every url field is an absolute https URL", () => {
  const problems = [];
  for (const name of URL_FILES) {
    const file = path.join(ROOT, "data", name);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    walkJson(json, "$", () => {}, (key, val, where) => {
      if (key !== "url" && !/_url$/.test(key)) return;
      if (typeof val !== "string" || !isHttpsUrl(val)) {
        problems.push(`data/${name} ${where}: not a valid absolute https URL (${JSON.stringify(val)})`);
      }
    });
  }
  assert.deepEqual(problems, []);
});

test("src/*.html and root *.html: every <script src> is a relative assets/js path", () => {
  assert.ok(SRC_HTML.length > 0 && ROOT_HTML.length > 0, "no html files found");
  const problems = [];
  for (const file of [...SRC_HTML, ...ROOT_HTML]) {
    for (const p of scriptProblems(fs.readFileSync(file, "utf8"))) problems.push(`${rel(file)} ${p}`);
  }
  assert.deepEqual(problems, []);
});

test("assets/js/*.js: fetch, XMLHttpRequest, sendBeacon and WebSocket use only relative URLs; no cookie writes", () => {
  assert.ok(JS_FILES.length > 0, "no assets/js/*.js files found");
  const problems = [];
  for (const file of JS_FILES) {
    for (const p of jsProblems(fs.readFileSync(file, "utf8"))) problems.push(`${rel(file)} ${p}`);
  }
  assert.deepEqual(problems, []);
});
