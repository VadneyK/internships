// Contract between style.css and the markup that uses it.
// 1. Every var(--x) is defined, has a fallback, or is on a short allowlist.
// 2. Every class used by built pages or assets/js/*.js has a rule in style.css, or is a named JS hook.
// 3. Every class selector in style.css is used by src, built pages or assets/js, or is on a short allowlist.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const list = (dir, ext) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).map((f) => path.posix.join(dir, f));

const CSS_FILE = "assets/css/style.css";
const css = read(CSS_FILE).replace(/\/\*[\s\S]*?\*\//g, "");
const pages = list(".", ".html");
const srcPages = list("src", ".html");
const jsFiles = list("assets/js", ".js");

// Custom properties that may be used without a definition in style.css.
const VAR_ALLOW = {
  "--w": "set inline on each bar (style=\"--w:17.09\") in the home page chart; it is data, not a theme token",
  "--line": "used as var(--line, var(--edge)); the fallback is the intended value and no theme sets --line",
};

// Classes used in markup or JS that need no rule in style.css.
const HOOK_ALLOW = {
  langlist: "JS or test hook on the languages page, no styling needed",
  nextstep: "hook for the next-step block, styled through its parent",
  packet: "hook for the printable packet wrapper, styled through its parent",
  "start-here": "hook for the home start block, styled through its parent",
  "start-title": "hook for the start block heading, styled through its parent",
  qrcard: "hook for the QR card, styled through its parent",
  cbreak: "hook for a print page-break wrapper, styled through its parent",
  "app-src": "hook for the application source line, styled through its parent",
  caveat: "hook for a caveat note, styled through its parent",
  src: "hook for a source line, styled through its parent",
  hgroup: "hook for a heading group, styled through its parent",
  verdict: "permit result card marker; the card look comes from the card class, and tests find it by this name",
  none: "verdict value for no permit needed; no style of its own",
  ask: "verdict value for check with the state; no style of its own",
  "star-ic": "the star shape inside the save button on find.html (find.js); the button rule styles it, and tests find the shape by this name",
  brow: "wrapper for one row in the home page bar chart; layout comes from .bl, .bt and .bk inside it",
};
// Body classes such as page-index are hooks for per-page selectors in tests and future CSS; none needs a rule.
const HOOK_PREFIX = { "page-": "per-page body class written by the build" };

// Class selectors in style.css that nothing uses on purpose.
const UNUSED_RULE_ALLOW = {
  marker: "font helper kept for future headings; the --marker font variable is used elsewhere",
  w3: "reserved name from the scan; not a class in style.css (only the w3.org SVG namespace text), listed so the scan note stays true",
};

// ---- CSS parsing ----
function cssDefined() {
  const props = new Set();
  for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) props.add(m[1]);
  return props;
}
function cssClasses() {
  // Collect the selector text before each "{", then pull .class names out of it.
  const found = new Set();
  const stripped = css.replace(/"[^"]*"|'[^']*'/g, '""').replace(/url\([^)]*\)/g, "url()");
  let buf = "";
  for (const ch of stripped) {
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      if (prelude.startsWith("@")) continue;
      const sel = prelude.replace(/\[[^\]]*\]/g, "");
      for (const m of sel.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) found.add(m[1]);
    } else if (ch === "}" || ch === ";") buf = "";
    else buf += ch;
  }
  return found;
}

// ---- usage scanning ----
function tokens(value) { return value.split(/\s+/).filter(Boolean); }
function htmlClasses(file) {
  const out = [];
  for (const m of read(file).matchAll(/\bclass="([^"]*)"/g)) for (const t of tokens(m[1])) out.push(t);
  return out;
}
function jsClasses(file) {
  const text = read(file);
  const out = [];
  const add = (value, trailingDynamic) => {
    const t = tokens(value);
    // A value like "tag " + x leaves the last word incomplete only when no trailing space marks the join; tokens ending in "-" are prefixes.
    for (const w of t) if (/^[A-Za-z_][\w-]*$/.test(w) && !w.endsWith("-")) out.push(w);
  };
  for (const m of text.matchAll(/\bclass=\\?(["'])([^"'\\]*)/g)) add(m[2]);
  for (const m of text.matchAll(/\bclassName\s*(?:\+)?=\s*(["'])([^"']*)\1/g)) add(m[2]);
  for (const m of text.matchAll(/classList\.(?:add|toggle|remove|contains)\(\s*(["'])([^"']*)\1/g)) add(m[2]);
  return out;
}

const defined = cssDefined();
const cssCls = cssClasses();

test("every var(--x) is defined, has a fallback, or is allowlisted", () => {
  const inline = new Set();
  for (const f of [...srcPages, ...pages, ...jsFiles]) for (const m of read(f).matchAll(/(--[\w-]+)\s*:/g)) inline.add(m[1]);
  const problems = [];
  for (const m of css.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    const [, name, fallback] = m;
    if (defined.has(name) || fallback || VAR_ALLOW[name] || inline.has(name)) continue;
    problems.push(`${CSS_FILE}: var(${name}) has no definition, no fallback and is not allowlisted`);
  }
  assert.deepEqual([...new Set(problems)], []);
});

test("var allowlist entries carry a reason and are still in use", () => {
  for (const [name, why] of Object.entries(VAR_ALLOW)) {
    assert.ok(why.length > 10, name + " needs a reason");
    assert.ok(css.includes("var(" + name), name + " is allowlisted but no longer used; remove it from VAR_ALLOW");
  }
});

test("every class used by built pages and JS has a rule in style.css or is a named hook", () => {
  const problems = [];
  const seen = new Set();
  const check = (cls, file) => {
    const key = cls + "|" + file;
    if (seen.has(key)) return;
    seen.add(key);
    if (cssCls.has(cls) || HOOK_ALLOW[cls] || Object.keys(HOOK_PREFIX).some((p) => cls.startsWith(p))) return;
    problems.push(`class "${cls}" used in ${file} has no rule in ${CSS_FILE} and is not in HOOK_ALLOW`);
  };
  for (const f of pages) for (const c of htmlClasses(f)) check(c, f);
  for (const f of jsFiles) for (const c of jsClasses(f)) check(c, f);
  assert.deepEqual(problems, []);
});

test("hook allowlist entries carry a reason", () => {
  for (const [name, why] of Object.entries(HOOK_ALLOW)) assert.ok(why.length > 10, name + " needs a reason");
  for (const [name, why] of Object.entries(UNUSED_RULE_ALLOW)) assert.ok(why.length > 10, name + " needs a reason");
});

test("every class selector in style.css is used somewhere", () => {
  const used = new Set();
  for (const f of [...srcPages, ...pages]) for (const c of htmlClasses(f)) used.add(c);
  for (const f of jsFiles) {
    for (const c of jsClasses(f)) used.add(c);
    // Classes also appear in selectors and string pieces; count any whole word in a JS file as a use.
    for (const w of read(f).match(/[A-Za-z_][\w-]*/g) || []) used.add(w);
  }
  // Classes applied in built markup through templates in src, e.g. class="a {{ x }}", are covered by htmlClasses on src pages.
  const problems = [];
  for (const cls of cssCls) {
    if (used.has(cls) || UNUSED_RULE_ALLOW[cls]) continue;
    problems.push(`class ".${cls}" has a rule in ${CSS_FILE} but no page, src template or JS file uses it`);
  }
  assert.deepEqual(problems, []);
});
