// Code hygiene for the scripts a teen's browser runs.
// Two parts:
// 1. Static: every assets/js/*.js file and every inline <script> in src/*.html is scanned for console.log, console.debug,
//    debugger, eval(, new Function(, document.write and TODO, FIXME or XXX notes. Strings, template text, regex literals and
//    comments are blanked before the code rules run, so a word inside a string or a comment does not trip a code rule.
//    The TODO rule scans comments only. Every hit fails with its file and line.
// 2. Dynamic: every built root *.html page is loaded in jsdom with its real scripts. The names on its window are compared with
//    a fresh blank jsdom window. Any added name must be on ALLOWED_GLOBALS below. A new global fails with its name and the page.
//    A name on the list that no page adds any more also fails, so the list stays honest.
// Run with: node --test tests/r3-tests-7-code-hygiene.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const JS_FILES = fs.readdirSync(path.join(ROOT, "assets/js")).filter((f) => f.endsWith(".js")).sort().map((f) => "assets/js/" + f);
const SRC_HTML = fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".html")).sort().map((f) => "src/" + f);
const ROOT_HTML = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// Code rules, run on code with strings and comments blanked.
const CODE_RULES = [
  { re: /\bconsole\s*\.\s*log\s*\(/, why: "console.log call left in code" },
  { re: /\bconsole\s*\.\s*debug\s*\(/, why: "console.debug call left in code" },
  { re: /\bdebugger\b/, why: "debugger statement left in code" },
  { re: /\beval\s*\(/, why: "eval() call" },
  { re: /\bnew\s+Function\s*\(/, why: "new Function() call" },
  { re: /\bdocument\s*\.\s*write(ln)?\s*\(/, why: "document.write call" },
];
// Note rules, run on comment text only.
const NOTE_RULE = { re: /\b(TODO|FIXME|XXX)\b/, why: "TODO, FIXME or XXX note left in a comment" };

// Blank strings, template text, regex literals and comments. Returns the code (same length, newlines kept,
// blanked characters replaced by spaces) and the comments as { start, text }.
// Template ${...} parts are kept as code so the code rules still see them.
export function stripJs(src) {
  const n = src.length;
  let code = "";
  const comments = [];
  let i = 0;
  let lastSig = ""; // last non-space character kept as code, used to tell a regex literal from a division
  const blank = (s) => s.replace(/[^\n]/g, " ");
  const keep = (s) => { code += s; const t = s.trim(); if (t) lastSig = t[t.length - 1]; };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      let j = src.indexOf("\n", i);
      if (j < 0) j = n;
      comments.push({ start: i, text: src.slice(i, j) });
      code += blank(src.slice(i, j));
      i = j;
      continue;
    }
    if (c === "/" && d === "*") {
      let j = src.indexOf("*/", i + 2);
      j = j < 0 ? n : j + 2;
      comments.push({ start: i, text: src.slice(i, j) });
      code += blank(src.slice(i, j));
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      j = Math.min(j + 1, n);
      code += blank(src.slice(i, j));
      lastSig = c;
      i = j;
      continue;
    }
    if (c === "`") {
      let j = i + 1;
      let text = "`";
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") { text += "  "; j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") {
          // keep the expression inside ${ } as code; the template text before it is blanked
          code += blank(text);
          text = "";
          let depth = 0;
          let k = j + 1;
          for (; k < n; k++) {
            if (src[k] === "{") depth++;
            else if (src[k] === "}") { depth--; if (depth === 0) break; }
          }
          code += "  " + src.slice(j + 2, k) + " ";
          j = k + 1;
          continue;
        }
        text += src[j] === "\n" ? "\n" : " ";
        j++;
      }
      j = Math.min(j + 1, n);
      code += blank(text);
      lastSig = "`";
      i = j;
      continue;
    }
    if (c === "/") {
      const regexAllowed = lastSig === "" || "(,=:[!&|?{};+-*%<>~^".includes(lastSig);
      if (regexAllowed) {
        let j = i + 1;
        let inClass = false;
        while (j < n && src[j] !== "\n") {
          const e = src[j];
          if (e === "\\") { j += 2; continue; }
          if (e === "[") inClass = true;
          else if (e === "]") inClass = false;
          else if (e === "/" && !inClass) break;
          j++;
        }
        j = Math.min(j + 1, n);
        while (j < n && /[a-z]/i.test(src[j])) j++;
        code += blank(src.slice(i, j));
        lastSig = "/";
        i = j;
        continue;
      }
    }
    keep(c);
    i++;
  }
  return { code, comments };
}

// Line number (1 based) of a character index.
function lineOf(text, index) {
  let line = 1;
  for (let k = 0; k < index; k++) if (text.charCodeAt(k) === 10) line++;
  return line;
}

// Scan one script source. Returns violations as "file:line rule".
export function scanScript(file, src, baseLine = 1) {
  const { code, comments } = stripJs(src);
  const out = [];
  for (const rule of CODE_RULES) {
    const re = new RegExp(rule.re.source, "g");
    let m;
    while ((m = re.exec(code))) out.push(`${file}:${baseLine + lineOf(code, m.index) - 1} ${rule.why}`);
  }
  for (const cm of comments) {
    const re = new RegExp(NOTE_RULE.re.source, "g");
    let m;
    while ((m = re.exec(cm.text))) {
      out.push(`${file}:${baseLine + lineOf(src, cm.start + m.index) - 1} ${NOTE_RULE.why}`);
    }
  }
  return out;
}

// Inline <script> bodies (no src attribute) of an HTML source, with the line where each body starts.
export function inlineScripts(html) {
  const found = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    const bodyStart = m.index + m[0].indexOf(m[2]);
    found.push({ body: m[2], line: lineOf(html, bodyStart) });
  }
  return found;
}

test("static: no console.log, console.debug, debugger, eval, new Function, document.write or TODO notes in assets/js or inline scripts", () => {
  const violations = [];
  for (const f of JS_FILES) violations.push(...scanScript(f, read(f)));
  for (const f of SRC_HTML) {
    for (const s of inlineScripts(read(f))) violations.push(...scanScript(f, s.body, s.line));
  }
  assert.equal(violations.length, 0, "code hygiene hits:\n" + violations.join("\n"));
});

test("static: the scanner fires on code and ignores strings and comments", () => {
  const hits = (src) => scanScript("fixture.js", src).map((v) => v.replace(/^fixture\.js:\d+ /, ""));
  assert.deepEqual(hits("console.log(1);"), ["console.log call left in code"]);
  assert.deepEqual(hits("console . debug(1)"), ["console.debug call left in code"]);
  assert.deepEqual(hits("function f() { debugger; }"), ["debugger statement left in code"]);
  assert.deepEqual(hits("var x = eval('1');"), ["eval() call"]);
  assert.deepEqual(hits("var f = new Function('a', 'return a');"), ["new Function() call"]);
  assert.deepEqual(hits("document.write('<p>');"), ["document.write call"]);
  assert.deepEqual(hits("var r = retrieval(1);"), []);
  assert.deepEqual(hits("var s = 'console.log(1) eval(2)'; var t = `debugger`;"), []);
  assert.deepEqual(hits("var re = /eval\\(/; var z = a / b / c;"), []);
  assert.deepEqual(hits("// console.log(1) and debugger\n/* eval(x) */ var a = 1;"), []);
  assert.deepEqual(hits("var t = `${console.log(1)}`;"), ["console.log call left in code"]);
  assert.deepEqual(hits("// TODO: fix this\nvar a = 1;"), ["TODO, FIXME or XXX note left in a comment"]);
  assert.deepEqual(hits("var a = 1; /* FIXME later */"), ["TODO, FIXME or XXX note left in a comment"]);
  assert.deepEqual(hits("var a = 'TODO';"), []);
  const v = scanScript("x.js", "var a = 1;\n\nconsole.log(a);\n");
  assert.deepEqual(v, ["x.js:3 console.log call left in code"]);
});

// Globals a page script adds that are expected. Each name is on its own line with the reason. Remove a name once no page adds it.
// Built from the run on 2026-10-10. Every page adds the same four names.
const ALLOWED_GLOBALS = {
  fetch: "shim set by tests/dom-helper.mjs (jsdom has no fetch); the page does not add it",
  matchMedia: "shim set by tests/dom-helper.mjs when jsdom lacks it; the page does not add it",
  t: "top-level var in the inline theme script in src/_layout.html (the page's own leak, kept until that template is changed)",
  TIG: "shared helper namespace set by assets/js/common.js (window.TIG); the pages use it on purpose",
};

// Names on a fresh blank jsdom window, the baseline.
function blankWindowNames() {
  const blank = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    url: "http://127.0.0.1/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  const names = new Set(Object.getOwnPropertyNames(blank.window));
  blank.window.close();
  return names;
}

const BASELINE = blankWindowNames();
const addedByPage = new Map(); // page -> [names not on the baseline]

for (const page of ROOT_HTML) {
  test(`dynamic: ${page} adds only allowed globals to window`, async () => {
    const { dom, window } = await loadPage(page);
    try {
      const added = Object.getOwnPropertyNames(window).filter((n) => !BASELINE.has(n));
      addedByPage.set(page, added);
      const bad = added.filter((n) => !Object.prototype.hasOwnProperty.call(ALLOWED_GLOBALS, n));
      assert.deepEqual(bad, [], `${page} adds window globals not on ALLOWED_GLOBALS: ${bad.join(", ")}`);
    } finally {
      dom.window.close();
    }
  });
}

test("dynamic: every ALLOWED_GLOBALS name is still added by some page", () => {
  // runs after the page tests in this file; node:test runs tests in order within a file
  const seen = new Set();
  for (const names of addedByPage.values()) for (const n of names) seen.add(n);
  const stale = Object.keys(ALLOWED_GLOBALS).filter((n) => !seen.has(n));
  assert.deepEqual(stale, [], `ALLOWED_GLOBALS names no page adds any more (remove them): ${stale.join(", ")}`);
});
