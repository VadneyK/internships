// Checks that every id literal the page scripts look up exists on each built root page that loads the script,
// or is created by the script itself. Also checks every script in assets/js is loaded by at least one page.
// Run with: node --test tests/r2-tests-6-js-id-contract.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JS_DIR = path.join(ROOT, "assets", "js");

// Scripts every page may load. lib.js has no id lookups; common.js is checked against all root pages.
const SHARED_SCRIPTS = new Set(["lib.js", "common.js"]);

// Ids that a script looks up but that are allowed to be missing from a page. Each entry needs a reason.
// Empty today: the probe found no misses.
const ALLOW = [];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Literal ids read by the script: $("id"), getElementById("id"), querySelector("#id") and querySelectorAll("#id ...").
// The leading #id of a selector is taken only when it ends at a space, [, ., :, >, comma or quote.
function lookupIds(src) {
  const out = new Set();
  for (const m of src.matchAll(/\$\(\s*(["'])([^"'\\]+)\1\s*\)/g)) out.add(m[2]);
  for (const m of src.matchAll(/getElementById\(\s*(["'])([^"'\\]+)\1\s*\)/g)) out.add(m[2]);
  for (const m of src.matchAll(/querySelector(?:All)?\(\s*(["'])#([A-Za-z][\w-]*)(?=[\s[.:>,"'])/g)) out.add(m[2]);
  return out;
}

// Ids the script creates: id="..." inside a template string (not a dynamic "p-" + value), .id = "...", setAttribute("id", "...").
function definedIds(src) {
  const out = new Set();
  for (const m of src.matchAll(/(?<=\s)id=\\?["']([A-Za-z][\w-]*)\\?["'](?!\s*\+)/g)) out.add(m[1]);
  for (const m of src.matchAll(/\.id\s*=\s*(["'])([A-Za-z][\w-]*)\1/g)) out.add(m[2]);
  for (const m of src.matchAll(/setAttribute\(\s*["']id["']\s*,\s*(["'])([A-Za-z][\w-]*)\1/g)) out.add(m[2]);
  return out;
}

// Static id attributes in a built page.
function staticIds(html) {
  return new Set([...html.matchAll(/(?<=\s)id=["']([^"']+)["']/g)].map((m) => m[1]));
}

// Pages whose script tag names the script file, with or without a ?v= query.
function loaders(jsName, pages) {
  const re = new RegExp(`src="assets/js/${escapeRe(jsName)}(?:\\?[^"]*)?"`);
  return pages.filter((p) => re.test(p.html));
}

// Pure check used by the real suite and by the seeded fixture. pages: [{ name, html }].
function findMisses({ script, pages, allow = [] }) {
  const ids = lookupIds(script.src);
  const created = definedIds(script.src);
  const allowed = new Set(allow.filter((a) => a.script === script.name).map((a) => a.id));
  const misses = [];
  for (const page of pages) {
    const have = staticIds(page.html);
    for (const id of ids) {
      if (have.has(id) || created.has(id) || allowed.has(id)) continue;
      misses.push(`${script.name} on ${page.name} looks up #${id}, which is not in the page or made by the script`);
    }
  }
  return misses;
}

function readRootPages() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort()
    .map((name) => ({ name, html: fs.readFileSync(path.join(ROOT, name), "utf8") }));
}

function readScripts() {
  return fs.readdirSync(JS_DIR).filter((f) => f.endsWith(".js")).sort()
    .map((name) => ({ name, src: fs.readFileSync(path.join(JS_DIR, name), "utf8") }));
}

const pages = readRootPages();
const scripts = readScripts();

test("every assets/js script except lib.js is loaded by at least one root page", () => {
  const unloaded = scripts
    .filter((s) => s.name !== "lib.js")
    .filter((s) => loaders(s.name, pages).length === 0)
    .map((s) => s.name);
  assert.deepEqual(unloaded, [], "scripts loaded by no page: " + unloaded.join(", "));
});

test("every id a page script looks up exists on each page that loads it, or is made by the script", () => {
  const misses = [];
  for (const script of scripts) {
    if (SHARED_SCRIPTS.has(script.name)) continue;
    misses.push(...findMisses({ script, pages: loaders(script.name, pages), allow: ALLOW }));
  }
  assert.deepEqual(misses, [], misses.join("\n"));
});

test("common.js and lib.js ids exist on every root page", () => {
  const misses = [];
  for (const name of SHARED_SCRIPTS) {
    const script = scripts.find((s) => s.name === name);
    assert.ok(script, name + " is missing from assets/js");
    misses.push(...findMisses({ script, pages, allow: ALLOW }));
  }
  assert.deepEqual(misses, [], misses.join("\n"));
});

test("every allow-list entry names a script, an id and a reason", () => {
  for (const a of ALLOW) {
    assert.ok(a.script && a.id && a.reason, "incomplete ALLOW entry: " + JSON.stringify(a));
  }
});

test("seeded fixture: a missing id is caught and named by script, page and id", () => {
  const script = { name: "fixture.js", src: 'var $ = function (id) { return document.getElementById(id); };\n$("present"); $("gone");' };
  const page = { name: "fixture.html", html: '<main><div id="present"></div></main>' };
  const misses = findMisses({ script, pages: [page] });
  assert.equal(misses.length, 1);
  assert.match(misses[0], /fixture\.js/);
  assert.match(misses[0], /fixture\.html/);
  assert.match(misses[0], /#gone/);
});

test("seeded fixture: ids the script creates, and allow-listed ids, are not reported", () => {
  const script = {
    name: "fixture2.js",
    src: [
      '$("made"); document.getElementById("viaProp"); document.querySelector("#viaTpl a");',
      'var n = document.createElement("div"); n.id = "viaProp";',
      'var html = `<section id="viaTpl"></section>`;',
      'el.setAttribute("id", "made");',
      '$("optional");',
    ].join("\n"),
  };
  const page = { name: "fixture2.html", html: "<main></main>" };
  const allow = [{ script: "fixture2.js", id: "optional", reason: "fixture: rendered only after a click" }];
  assert.deepEqual(findMisses({ script, pages: [page], allow }), []);
});

test("seeded fixture: a script loaded by no page is reported", () => {
  const orphan = { name: "orphan.js", src: "" };
  const onlyPage = { name: "x.html", html: '<script src="assets/js/other.js"></script>' };
  assert.deepEqual(loaders(orphan.name, [onlyPage]), []);
});
