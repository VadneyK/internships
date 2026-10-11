// Ticket r1-tests-1: static id checks on every built root page.
// 1. No id repeats in a page. 2. aria-controls, aria-labelledby, aria-describedby and label[for]
// point at an id that exists (in the html, or on a short named allow list of ids made by JS).
// 3. An id read in a page's JS with $("x") or getElementById("x") is in the page html or is built in that JS.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Ids made by JS at run time, allowed as reference targets. Keep this short; every entry needs a reason.
const JS_MADE_REFERENCE_IDS = {
  // "someId": "why JS creates it",
};

function htmlFiles() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
}

function scriptsOf(doc) {
  return [...doc.querySelectorAll("script[src]")]
    .map((s) => s.getAttribute("src").split("?")[0])
    .filter((s) => /^assets\/js\/[^/]+\.js$/.test(s) && fs.existsSync(path.join(ROOT, s)));
}

// Ids a JS source builds itself: id="x, .id = "x", id: "x", setAttribute("id", "x"), for="x.
function idsBuiltIn(src) {
  const out = new Set();
  const pats = [/\bid=\\?["']([A-Za-z][\w-]*)/g, /\.id\s*=\s*["']([A-Za-z][\w-]*)["']/g, /\bid:\s*["']([A-Za-z][\w-]*)["']/g, /setAttribute\(\s*["']id["']\s*,\s*["']([A-Za-z][\w-]*)["']/g];
  for (const re of pats) for (const m of src.matchAll(re)) out.add(m[1]);
  return out;
}

// Id literals the JS reads.
function idsReadIn(src) {
  const out = new Set();
  for (const m of src.matchAll(/(?:(?<![\w.])\$|getElementById)\(\s*["']([A-Za-z][\w-]*)["']\s*\)/g)) out.add(m[1]);
  return out;
}

// Returns a list of defect strings for one page.
export function checkPage(name, html, jsSources, allow = JS_MADE_REFERENCE_IDS) {
  const doc = new JSDOM(html).window.document;
  const defects = [];
  const ids = new Map();
  for (const el of doc.querySelectorAll("[id]")) ids.set(el.id, (ids.get(el.id) || 0) + 1);
  for (const [id, n] of ids) if (n > 1) defects.push(`${name}: id "${id}" appears ${n} times`);
  const known = (id) => ids.has(id) || Object.hasOwn(allow, id);
  const refs = [["aria-controls", "[aria-controls]"], ["aria-labelledby", "[aria-labelledby]"], ["aria-describedby", "[aria-describedby]"], ["for", "label[for]"]];
  for (const [attr, sel] of refs) {
    for (const el of doc.querySelectorAll(sel)) {
      for (const id of el.getAttribute(attr).split(/\s+/).filter(Boolean)) {
        if (!known(id)) defects.push(`${name}: ${attr}="${id}" has no element with that id`);
      }
    }
  }
  const built = new Set();
  for (const src of jsSources) for (const id of idsBuiltIn(src)) built.add(id);
  for (const src of jsSources) {
    for (const id of idsReadIn(src)) {
      if (!ids.has(id) && !built.has(id)) defects.push(`${name}: JS reads id "${id}" that is not in the html or built in JS`);
    }
  }
  return defects;
}

test("every built page has unique ids and every id reference resolves", () => {
  const files = htmlFiles();
  assert.ok(files.length >= 15, "expected the built root pages, found " + files.length);
  const all = [];
  for (const f of files) {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    const doc = new JSDOM(html).window.document;
    const js = scriptsOf(doc).map((s) => fs.readFileSync(path.join(ROOT, s), "utf8"));
    all.push(...checkPage(f, html, js));
  }
  assert.deepEqual(all, [], "id defects by page:\n" + all.join("\n"));
});

test("allow list entries each have a reason and are still needed", () => {
  for (const [id, why] of Object.entries(JS_MADE_REFERENCE_IDS)) assert.ok(why && why.length > 10, id + " needs a reason");
});

test("self-check: a seeded bad fixture is caught", () => {
  const html = `<!doctype html><html><body>
    <div id="a"></div><div id="a"></div>
    <button aria-controls="gone"></button>
    <p aria-labelledby="a nope"></p><p aria-describedby="missing2"></p>
    <label for="noInput">x</label><input id="ok">
  </body></html>`;
  const js = [`const x = $("ok"); const y = $("renamed"); document.getElementById("alsoGone"); el.id = "madeHere"; $("madeHere");`];
  const d = checkPage("bad.html", html, js, {});
  const text = d.join("\n");
  for (const want of ['id "a" appears 2', 'aria-controls="gone"', 'aria-labelledby="nope"', 'aria-describedby="missing2"', 'for="noInput"', 'id "renamed"', 'id "alsoGone"']) assert.ok(text.includes(want), "missed: " + want + "\n" + text);
  assert.ok(!text.includes('"madeHere"'), "JS-built id must be allowed");
  assert.ok(!text.includes('"ok"'));
  // a good fixture is clean, and the allow list works
  assert.deepEqual(checkPage("good.html", '<div id="x"></div><label for="x"></label><i aria-controls="made"></i>', ['$("x")'], { made: "JS makes it" }), []);
});
