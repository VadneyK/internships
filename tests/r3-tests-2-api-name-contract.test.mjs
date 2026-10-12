// Static check: every L.<name>, G.<name> and TIG.lib.<name> a page script reads must exist.
// L is lib.js (window.TIG.lib, module.exports in Node). G is window.TIG, filled in by common.js.
// A typo or a renamed export otherwise fails only when that branch runs, which jsdom tests may never reach.
// Run with: node --test tests/r3-tests-2-api-name-contract.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS_DIR = path.join(ROOT, "assets", "js");
const require = createRequire(import.meta.url);
const LIB = require(path.join(JS_DIR, "lib.js"));

// Names set at runtime by a script other than lib.js and common.js. Each entry needs a reason.
const ALLOW = {
  G: {
    cardHtml: "find.js sets G.cardHtml for its own later use; it is not defined by common.js",
  },
  L: {},
};

// Returns the source with comments and string text blanked to spaces (newlines kept, so line numbers hold).
// Code inside ${ } of a template string is kept. Regex literals are skipped by a simple "after an operator" rule.
export function stripSource(src) {
  const out = [];
  const blank = (s) => s.replace(/[^\n]/g, " ");
  let i = 0;
  const n = src.length;
  let last = ""; // last significant code character, to tell a regex from a division
  const braceStack = []; // for template ${ } nesting: depth of braces at each open ${
  let depth = 0;
  function template() {
    out.push(" ");
    i++; // opening backtick
    while (i < n) {
      const c = src[i];
      if (c === "\\") { out.push(blank(src.slice(i, i + 2))); i += 2; continue; }
      if (c === "`") { out.push(" "); i++; return; }
      if (c === "$" && src[i + 1] === "{") {
        out.push("  "); i += 2;
        code(true);
        continue;
      }
      out.push(blank(c)); i++;
    }
  }
  function code(inTemplate) {
    let d = 0;
    while (i < n) {
      const c = src[i], c2 = src[i + 1];
      if (c === "/" && c2 === "/") { let j = src.indexOf("\n", i); if (j < 0) j = n; out.push(blank(src.slice(i, j))); i = j; continue; }
      if (c === "/" && c2 === "*") { let j = src.indexOf("*/", i + 2); j = j < 0 ? n : j + 2; out.push(blank(src.slice(i, j))); i = j; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
        out.push(c + blank(src.slice(i + 1, j)) + (src[j] === c ? c : "")); i = Math.min(j + 1, n); last = c; continue;
      }
      if (c === "`") { template(); last = "`"; continue; }
      if (c === "/" && (last === "" || "(,=:[!&|?{};+-*%<>~^".includes(last) || /(?:return|typeof)$/.test(out.join("").slice(-8).trimEnd()))) {
        let j = i + 1, cls = false;
        while (j < n && src[j] !== "\n" && (cls || src[j] !== "/")) { if (src[j] === "\\") j++; else if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; j++; }
        out.push("/" + blank(src.slice(i + 1, j)) + "/"); i = j + 1; last = "/"; continue;
      }
      if (inTemplate) {
        if (c === "{") d++;
        if (c === "}") { if (d === 0) { out.push(" "); i++; return; } d--; }
      }
      out.push(c); i++;
      if (!/\s/.test(c)) last = c;
    }
  }
  code(false);
  return out.join("");
}

// Every property read off L, G and TIG.lib in one source text: [{ obj: "L" | "G", name, line }].
export function apiReads(src) {
  const code = stripSource(src);
  const reads = [];
  const lineOf = (idx) => code.slice(0, idx).split("\n").length;
  const add = (obj, name, idx) => reads.push({ obj, name, line: lineOf(idx) });
  for (const m of code.matchAll(/(?<![\w$.])(?:window\.)?TIG\.lib\.([A-Za-z_$][\w$]*)/g)) add("L", m[1], m.index);
  for (const m of code.matchAll(/(?<![\w$.])G\.lib\.([A-Za-z_$][\w$]*)/g)) add("L", m[1], m.index);
  for (const m of code.matchAll(/(?<![\w$.])L\.([A-Za-z_$][\w$]*)/g)) add("L", m[1], m.index);
  for (const m of code.matchAll(/(?<![\w$.])(?:window\.)?TIG\.(?!lib\b)([A-Za-z_$][\w$]*)/g)) add("G", m[1], m.index);
  for (const m of code.matchAll(/(?<![\w$.])G\.(?!lib\b)([A-Za-z_$][\w$]*)/g)) add("G", m[1], m.index);
  return reads.sort((a, b) => a.line - b.line);
}

// Reads that are not in the known names and not on the allow-list.
export function missingNames(files, known, allow = ALLOW) {
  const misses = [];
  for (const [file, src] of files) {
    for (const r of apiReads(src)) {
      if (known[r.obj].has(r.name) || allow[r.obj][r.name]) continue;
      misses.push(`${file}:${r.line} ${r.obj}.${r.name}`);
    }
  }
  return misses;
}

const files = fs.readdirSync(JS_DIR).filter((f) => f.endsWith(".js")).sort().map((f) => [`assets/js/${f}`, fs.readFileSync(path.join(JS_DIR, f), "utf8")]);

// G names common.js sets: read from the assignments in its source, then added to by what a real page ends up with.
async function knownNames() {
  const L = new Set(Object.keys(LIB));
  const G = new Set(["lib"]); // lib.js puts itself on TIG
  const common = stripSource(fs.readFileSync(path.join(JS_DIR, "common.js"), "utf8"));
  for (const m of common.matchAll(/(?<![\w$.])G\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) G.add(m[1]);
  const { window } = await loadPage("jobs.html");
  for (const k of Object.keys(window.TIG)) G.add(k);
  return { L, G };
}

test("the scan reads every page script", () => {
  assert.ok(files.length >= 15, "found " + files.length + " scripts");
  const total = files.reduce((n, [, s]) => n + apiReads(s).length, 0);
  assert.ok(total > 100, "expected many L/G reads, found " + total);
});

test("every L.* G.* and TIG.lib.* name a page script reads exists", async () => {
  const known = await knownNames();
  assert.ok(known.L.size > 30 && known.G.has("toast") && known.G.has("fetchData"), "known names look loaded");
  const misses = missingNames(files, known);
  assert.deepEqual(misses, [], "names read but never exported:\n" + misses.join("\n"));
});

test("seeded bad snippets fail the same scan", async () => {
  const known = await knownNames();
  const bad = [["seed.js", "var L = G.lib;\nfunction f() {\n  return L.notAThing(1);\n}\nG.alsoNotThere();\nwindow.TIG.lib.nopeToo;"]];
  assert.deepEqual(missingNames(bad, known), ["seed.js:3 L.notAThing", "seed.js:5 G.alsoNotThere", "seed.js:6 L.nopeToo"]);
  const good = [["ok.js", "L.esc('x'); G.toast('y'); // L.notAThing\nvar s = \"G.nope\"; /* L.nope */ var t = `a ${G.toast('z')} L.nope`;"]];
  assert.deepEqual(missingNames(good, known), []);
});

test("the allow-list holds only names that are still read and still missing from lib.js and common.js", async () => {
  const known = await knownNames();
  for (const obj of ["L", "G"]) {
    for (const name of Object.keys(ALLOW[obj])) {
      assert.ok(!known[obj].has(name), `${obj}.${name} is now exported; drop it from ALLOW`);
      assert.ok(files.some(([, s]) => apiReads(s).some((r) => r.obj === obj && r.name === name)), `${obj}.${name} is no longer read; drop it from ALLOW`);
    }
  }
});
