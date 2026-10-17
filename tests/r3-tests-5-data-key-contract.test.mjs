// r3-tests-5: every snake_case data key that the scripts and tools read must exist in the data.
// A typo such as e.deadline_isoo gives undefined silently and the page just shows less.
// Known keys come from data/*.json, data/programs/*.json and data/schema/program.schema.json properties.
// Reads scanned: x.some_key and x['some_key'] in assets/js/*.js and inline <script> in src/*.html,
// and .get('some_key') and ['some_key'] in tools/*.py. Only keys with an underscore are checked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const list = (d, ext) => readdirSync(join(root, d)).filter((f) => f.endsWith(ext)).sort().map((f) => d + "/" + f);

// Names that are not data keys. Every entry must still be used somewhere, or the test fails.
const ALLOWED = {
  gaps_list: "build.py template placeholder filled into src/contribute.html, not a data key",
  lang_switch: "build.py template placeholder for the language link in the nav (ADR 0008), not a data key",
};

const known = new Set();
function collect(v) {
  if (Array.isArray(v)) { for (const x of v) collect(x); return; }
  if (v && typeof v === "object") {
    for (const k of Object.keys(v)) { known.add(k); collect(v[k]); }
  }
}
for (const f of [...list("data", ".json"), ...list("data/programs", ".json"), "data/schema/program.schema.json"]) {
  collect(JSON.parse(read(f)));
}

const SNAKE = "[a-z][a-z0-9]*(?:_[a-z0-9]+)+";

// Replace comments and string contents with spaces, keeping line breaks and offsets.
// Strings of the form ['key'] are caught before blanking by scanning the original text.
function blankJs(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  const keep = (c) => (c === "\n" ? "\n" : " ");
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") { out += " "; i++; } continue; }
    if (c === "/" && d === "*") { out += "  "; i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += keep(src[i]); i++; } out += "  "; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; out += q; i++;
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") { out += " "; i++; }
        if (i < n) { out += keep(src[i]); i++; }
      }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

function lineOf(text, idx) { let l = 1; for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) l++; return l; }

const reads = []; // { file, line, key }
function scanJs(file, src) {
  const blank = blankJs(src);
  for (const m of blank.matchAll(new RegExp("[\\w$\\)\\]]\\??\\.(" + SNAKE + ")\\b", "g"))) {
    reads.push({ file, line: lineOf(blank, m.index), key: m[1] });
  }
  for (const m of src.matchAll(new RegExp("[\\w$\\)\\]]\\[\\s*(['\"])(" + SNAKE + ")\\1\\s*\\]", "g"))) {
    // skip matches that sit inside a comment (blank text has spaces at the quote position only for strings, so check the bracket)
    if (blank[m.index + m[0].indexOf("[")] !== "[") continue;
    reads.push({ file, line: lineOf(src, m.index), key: m[2] });
  }
}
for (const f of list("assets/js", ".js")) scanJs(f, read(f));
for (const f of list("src", ".html")) {
  const html = read(f);
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=["']application\/(?:ld\+)?json)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const startLine = lineOf(html, m.index + m[0].indexOf(">") + 1);
    const before = reads.length;
    scanJs(f, m[1]);
    for (let i = before; i < reads.length; i++) reads[i].line += startLine - 1;
  }
}
for (const f of list("tools", ".py")) {
  const src = read(f);
  // blank comments only (strings hold the keys)
  const text = src.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "$1")).join("\n");
  for (const m of text.matchAll(new RegExp("\\.get\\(\\s*(['\"])(" + SNAKE + ")\\1", "g"))) reads.push({ file: f, line: lineOf(text, m.index), key: m[2] });
  for (const m of text.matchAll(new RegExp("\\[\\s*(['\"])(" + SNAKE + ")\\1\\s*\\]", "g"))) reads.push({ file: f, line: lineOf(text, m.index), key: m[2] });
}

test("the scan finds reads, so the guard is not empty", () => {
  assert.ok(known.size > 100, "known keys: " + known.size);
  assert.ok(reads.length > 50, "reads found: " + reads.length);
  assert.ok(reads.some((r) => r.file.startsWith("assets/js")) && reads.some((r) => r.file.startsWith("tools")));
});

test("every snake_case key read by scripts and tools exists in the data or is allowed", () => {
  const bad = reads.filter((r) => !known.has(r.key) && !(r.key in ALLOWED));
  assert.deepEqual(bad.map((r) => `${r.file}:${r.line} unknown key '${r.key}'`), []);
});

test("every ALLOWED entry is still read and still not a data key", () => {
  const used = new Set(reads.map((r) => r.key));
  const stale = Object.keys(ALLOWED).filter((k) => !used.has(k) || known.has(k));
  assert.deepEqual(stale, [], "remove these from ALLOWED: " + stale.join(", "));
  for (const [k, why] of Object.entries(ALLOWED)) assert.ok(why && why.length > 5, "ALLOWED needs a reason: " + k);
});
