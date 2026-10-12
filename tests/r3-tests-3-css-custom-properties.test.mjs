// CSS custom property contract for assets/css/style.css.
// 1. Every var(--name) with no fallback is defined in style.css, or set inline in src/*.html or assets/js/*.js, or is on VAR_ALLOW.
// 2. Every colour token defined in :root is redefined in both dark-mode blocks (prefers-color-scheme and [data-theme="dark"]), or is on DARK_ALLOW.
//    Every token a dark block redefines must also exist in :root, so a typo such as --papr cannot hide.
// 3. Every token defined in :root is used somewhere (style.css, src or assets/js), or is on UNUSED_ALLOW.
// Each allow-list entry must still be needed, so a stale entry fails too.
// The same audit function runs on the real stylesheet and on a seeded bad string, which must fail.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const list = (dir, ext) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).map((f) => path.posix.join(dir, f));

// Custom properties that may be used without a definition in style.css, with the reason.
const VAR_ALLOW = {
  "--w": "bar width set inline on each Home chart bar (style=\"--w:17.09\" in src/index.html); it is per-bar data, not a theme token",
};

// Colour tokens in :root that intentionally keep one value in dark mode, with the reason.
const DARK_ALLOW = {
  "--yellow": "accent highlight (.hl, .tag.y, .callout, .star, .check .box) that stays yellow with fixed #151515 text in both themes",
  "--on-orange": "text colour on the orange button (.btn:hover); dark text stays readable on the orange in both themes",
};

// Root tokens that no rule, page or script reads, with the reason.
const UNUSED_ALLOW = {};

const COLOUR_VALUE = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

// Drops comments, then returns a list of { context, selector, body } for every rule.
// @media and similar at-rules are walked into, and their inner rules get the at-rule text as context.
export function parseRules(css, context = "", out = []) {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const semi = css.indexOf(";", i);
    if (semi !== -1 && semi < open) { i = semi + 1; continue; } // @import, @charset or other statement
    const prelude = css.slice(i, open).trim();
    let depth = 0;
    let j = open;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") { depth--; if (depth === 0) break; }
    }
    const body = css.slice(open + 1, j);
    if (/^@(media|supports|layer|container)\b/.test(prelude)) {
      parseRules(body, context ? context + " > " + prelude : prelude, out);
    } else {
      out.push({ context, selector: prelude, body });
    }
    i = j + 1;
  }
  return out;
}

export function declarations(body) {
  const found = [];
  for (const part of body.split(";")) {
    const m = part.match(/^\s*(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]*?)\s*$/);
    if (m) found.push({ name: m[1], value: m[2] });
  }
  return found;
}

// Every var(--name) in the text, with whether a fallback follows the name.
export function varUses(text) {
  const uses = [];
  const re = /var\(\s*(--[A-Za-z0-9_-]+)\s*(,?)/g;
  let m;
  while ((m = re.exec(text)) !== null) uses.push({ name: m[1], fallback: m[2] === "," });
  return uses;
}

// Names set inline: style="--x:..." in src pages, and setProperty("--x", ...) or "--x": in scripts.
export function inlineNames(texts) {
  const names = new Set();
  for (const t of texts) {
    for (const m of t.matchAll(/--([A-Za-z][A-Za-z0-9_-]*)\s*:/g)) names.add("--" + m[1]);
    for (const m of t.matchAll(/setProperty\(\s*["'`](--[A-Za-z0-9_-]+)/g)) names.add(m[1]);
  }
  return names;
}

// Runs every check. Returns a list of problem strings; an empty list means the contract holds.
export function auditCustomProperties(cssRaw, { sources = [], inline = new Set(), varAllow = {}, darkAllow = {}, unusedAllow = {} } = {}) {
  const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = parseRules(css);
  const problems = [];

  const isRoot = (r) => r.context === "" && r.selector === ":root";
  const isDarkMedia = (r) => /prefers-color-scheme:\s*dark/.test(r.context) && r.selector.includes(':root:not([data-theme="light"])');
  const isDarkAttr = (r) => r.context === "" && r.selector === ':root[data-theme="dark"]';

  const rootDecls = new Map();
  for (const r of rules.filter(isRoot)) for (const d of declarations(r.body)) rootDecls.set(d.name, d.value);
  const darkMediaDecls = new Map();
  for (const r of rules.filter(isDarkMedia)) for (const d of declarations(r.body)) darkMediaDecls.set(d.name, d.value);
  const darkAttrDecls = new Map();
  for (const r of rules.filter(isDarkAttr)) for (const d of declarations(r.body)) darkAttrDecls.set(d.name, d.value);

  // A token counts as defined only outside the dark blocks, so a name that exists only in dark mode is still undefined in light mode.
  const definedInCss = new Set();
  for (const r of rules) {
    if (isDarkMedia(r) || isDarkAttr(r)) continue;
    for (const d of declarations(r.body)) definedInCss.add(d.name);
  }

  if (rootDecls.size === 0) problems.push("no custom properties found in :root");
  if (darkMediaDecls.size === 0) problems.push("no dark block found under @media (prefers-color-scheme: dark) :root:not([data-theme=\"light\"])");
  if (darkAttrDecls.size === 0) problems.push("no dark block found under :root[data-theme=\"dark\"]");

  // 1. Undefined var() with no fallback.
  const cssUses = varUses(css);
  const needsDefinition = new Set(cssUses.filter((u) => !u.fallback).map((u) => u.name));
  for (const name of [...needsDefinition].sort()) {
    if (definedInCss.has(name) || inline.has(name)) continue;
    if (Object.prototype.hasOwnProperty.call(varAllow, name)) continue;
    problems.push(`undefined var(${name}) with no fallback: not defined in style.css, not set inline, not on VAR_ALLOW`);
  }
  for (const name of Object.keys(varAllow)) {
    if (!needsDefinition.has(name) || definedInCss.has(name)) problems.push(`stale VAR_ALLOW entry ${name}: it is not an undefined var() with no fallback`);
  }

  // 2. Colour tokens in :root need a value in both dark blocks.
  const colourTokens = [...rootDecls].filter(([, v]) => COLOUR_VALUE.test(v)).map(([n]) => n);
  for (const name of colourTokens) {
    const missing = [];
    if (!darkMediaDecls.has(name)) missing.push("prefers-color-scheme dark");
    if (!darkAttrDecls.has(name)) missing.push('[data-theme="dark"]');
    if (missing.length === 0) continue;
    if (Object.prototype.hasOwnProperty.call(darkAllow, name)) continue;
    problems.push(`colour ${name} has no value in dark block(s): ${missing.join(", ")}`);
  }
  for (const name of Object.keys(darkAllow)) {
    const colour = colourTokens.includes(name);
    const missing = !darkMediaDecls.has(name) || !darkAttrDecls.has(name);
    if (!colour || !missing) problems.push(`stale DARK_ALLOW entry ${name}: it is not a colour in :root missing from a dark block`);
  }
  for (const [label, decls] of [["prefers-color-scheme dark", darkMediaDecls], ['[data-theme="dark"]', darkAttrDecls]]) {
    for (const name of decls.keys()) {
      if (!rootDecls.has(name)) problems.push(`${label} block redefines ${name}, which is not defined in :root`);
    }
  }

  // 3. Root tokens that nothing uses.
  const used = new Set(cssUses.map((u) => u.name));
  for (const text of sources) for (const u of varUses(text)) used.add(u.name);
  for (const name of rootDecls.keys()) {
    if (used.has(name)) continue;
    if (Object.prototype.hasOwnProperty.call(unusedAllow, name)) continue;
    problems.push(`token ${name} is defined in :root but never used`);
  }
  for (const name of Object.keys(unusedAllow)) {
    if (used.has(name) || !rootDecls.has(name)) problems.push(`stale UNUSED_ALLOW entry ${name}`);
  }

  return problems;
}

// ---- The real stylesheet and the files that may set or read tokens ----
const CSS = read("assets/css/style.css");
const htmlFiles = list("src", ".html").map(read);
const jsFiles = list("assets/js", ".js").map(read);
const sources = [...htmlFiles, ...jsFiles];
const inline = inlineNames(sources);
const realOpts = { sources, inline, varAllow: VAR_ALLOW, darkAllow: DARK_ALLOW, unusedAllow: UNUSED_ALLOW };

test("style.css: every var() without a fallback is defined", () => {
  const problems = auditCustomProperties(CSS, realOpts).filter((p) => p.startsWith("undefined var(") || p.startsWith("stale VAR_ALLOW"));
  assert.deepEqual(problems, []);
});

test("style.css: every colour token in :root is redefined in both dark blocks", () => {
  const problems = auditCustomProperties(CSS, realOpts).filter((p) => p.startsWith("colour ") || p.startsWith("stale DARK_ALLOW") || p.includes("redefines"));
  assert.deepEqual(problems, []);
});

test("style.css: every token defined in :root is used", () => {
  const problems = auditCustomProperties(CSS, realOpts).filter((p) => p.includes("never used") || p.startsWith("stale UNUSED"));
  assert.deepEqual(problems, []);
});

test("style.css: the full audit passes with no problems", () => {
  assert.deepEqual(auditCustomProperties(CSS, realOpts), []);
});

test("the audit reports a seeded bad stylesheet", () => {
  const bad = `
    :root { --paper: #fff; --ink: #000; --dead: #123; --gap: 4px; --unused-token: 1px; }
    @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper: #000; --ink: #fff; --dead: #222; } }
    :root[data-theme="dark"] { --paper: #000; --ink: #fff; --papr: #111; }
    body { color: var(--ink); background: var(--paper) var(--papr); margin: var(--mrgin); padding: var(--gap, 4px); }
  `;
  const problems = auditCustomProperties(bad, { sources: [], inline: new Set(), varAllow: {}, darkAllow: {}, unusedAllow: {} });
  const has = (re) => problems.some((p) => re.test(p));
  assert.ok(has(/undefined var\(--papr\)/), "a typo in a var() must fail: " + problems.join(" | "));
  assert.ok(has(/undefined var\(--mrgin\)/), "an undefined var() with no fallback must fail");
  assert.ok(!has(/undefined var\(--gap\)/), "a var() with a fallback is not an error");
  assert.ok(has(/colour --dead has no value in dark block\(s\): \[data-theme="dark"\]/), "a colour missing from one dark block must fail");
  assert.ok(has(/--papr, which is not defined in :root/), "a dark block token that is not in :root must fail");
  assert.ok(has(/token --unused-token is defined in :root but never used/), "an unused root token must fail");
  assert.ok(problems.length >= 5, "expected several problems, got " + problems.length);
});

test("the audit accepts a clean seeded stylesheet", () => {
  const good = `
    :root { --paper: #fff; --ink: #000; --gap: 4px; }
    @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper: #000; --ink: #fff; } }
    :root[data-theme="dark"] { --paper: #000; --ink: #fff; }
    body { color: var(--ink); background: var(--paper); padding: var(--gap); }
  `;
  assert.deepEqual(auditCustomProperties(good, { sources: [], inline: new Set() }), []);
});
