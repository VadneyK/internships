// Hostile saved-state matrix: every storage key is fed a wrong-type or hostile value on every page that loads
// a script reading it. The page must still load clean. Key inventory is rebuilt by scanning assets/js (same
// method as r2-tests-4-storage-inventory.test.mjs), then mapped to the pages that load each script.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const PAGES = fs.readdirSync(ROOT).filter((n) => n.endsWith(".html")).sort();
const NOW = Date.UTC(2026, 9, 10, 15, 0, 0);

// key -> set of scripts that touch it
function scanKeys() {
  const found = new Map();
  const add = (k, f) => { if (!found.has(k)) found.set(k, new Set()); found.get(k).add(f); };
  for (const f of fs.readdirSync(path.join(ROOT, "assets/js")).filter((n) => n.endsWith(".js"))) {
    const src = read("assets/js/" + f);
    for (const m of src.matchAll(/\bPREF_KEY\s*=\s*"([^"]+)"/g)) add(m[1], f);
    for (const m of src.matchAll(/(?:G\.store\.(?:get|set)|localStorage\.(?:getItem|setItem|removeItem))\(\s*"([^"]+)"/g)) add(m[1], f);
  }
  // the saved list and theme are read by common.js (and by scripts that call G.saved), so every page that loads common.js is covered
  return found;
}
function pagesFor(scripts) {
  return PAGES.filter((p) => {
    const html = read(p);
    return [...scripts].some((s) => html.includes("assets/js/" + s));
  });
}

const MARK = '<img src="x" id="pwn"><script id="pwn2">window.__pwn=1</script>';
const big = "a".repeat(200 * 1024);
const FIELDS = ["n", "g", "s", "age", "place", "q", "refs", "av", "name", "email", "phone", "org", "who", "group", "notes", "school", "grade", "title", "hours"];
const markupObj = Object.fromEntries(FIELDS.map((f) => [f, MARK]));
const VARIANTS = {
  "invalid JSON": { raw: "{not json" },
  number: { raw: "42" },
  array: { raw: JSON.stringify(["a", 1, null, {}]) },
  null: { raw: "null" },
  "empty string": { raw: "" },
  "200 KB string": { raw: JSON.stringify(big) },
  "proto keys": { raw: '{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}},"age":"13","place":"x"}' },
  "markup string": { raw: JSON.stringify(MARK) },
  "markup fields": { raw: JSON.stringify(markupObj) },
  "age 11": { raw: JSON.stringify({ age: "11", place: "Texas" }) },
  "age 99": { raw: JSON.stringify({ age: "99", place: "Texas" }) },
  "age abc": { raw: JSON.stringify({ age: "abc", place: "Texas" }) },
  "age number": { raw: JSON.stringify({ age: 14, place: 7 }) },
};

const BAD_TEXT = /undefined|\bNaN\b|\[object Object\]/;
function visibleText(d) {
  const c = d.body.cloneNode(true);
  c.querySelectorAll("script,style,noscript,template").forEach((n) => n.remove());
  return c.textContent.replace(/\s+/g, " ");
}
async function check(page, opts, label) {
  const p = await loadPage(page, { now: NOW, ...opts });
  try {
    const { window: w, document: d } = p;
    await new Promise((r) => setTimeout(r, 60));
    assert.deepEqual(p.errors, [], label + ": console or uncaught errors");
    const h1 = d.querySelector("h1");
    assert.ok(h1 && h1.textContent.trim().length > 0, label + ": main heading missing");
    const text = visibleText(d);
    const m = text.match(BAD_TEXT);
    assert.ok(!m, label + ": visible text has " + (m && m[0]) + " near: " + (m && text.slice(Math.max(0, m.index - 40), m.index + 40)));
    assert.equal(d.getElementById("pwn"), null, label + ": stored text became markup (img)");
    assert.equal(d.getElementById("pwn2"), null, label + ": stored text became markup (script)");
    assert.equal(w.__pwn, undefined, label + ": stored script ran");
    assert.equal(({}).polluted, undefined, "prototype polluted");
    assert.equal(w.Object.prototype.polluted, undefined, label + ": window prototype polluted");
  } finally { p.window.close(); }
}
async function pool(jobs, n = 6) {
  const q = jobs.slice(); const out = [];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const j = q.shift(); try { await j.run(); } catch (e) { out.push(j.label + " :: " + (e && e.message)); } } }));
  return out;
}

const found = scanKeys();

test("inventory: the scan finds the known keys and each maps to at least one page", () => {
  for (const k of ["theme", "findprefs", "saved", "ready", "me", "people", "leader", "resume", "interview"]) {
    assert.ok(found.has(k), "key not found in assets/js: " + k);
    assert.ok(pagesFor(found.get(k)).length > 0, "no page loads a script that reads " + k);
  }
});

test("every key x every reading page x every hostile value loads clean", { timeout: 900000 }, async () => {
  const jobs = [];
  for (const [key, scripts] of found) {
    const pages = key === "theme" || key === "saved" ? PAGES : pagesFor(scripts);
    for (const page of pages) {
      for (const [vn, v] of Object.entries(VARIANTS)) {
        const label = key + " / " + page + " / " + vn;
        jobs.push({ label, run: () => check(page, { rawStorage: { [key]: v.raw } }, label) });
      }
    }
  }
  const fails = await pool(jobs);
  assert.deepEqual(fails, [], fails.length + " failing combinations");
});

test("every page loads clean when localStorage throws on every call", { timeout: 300000 }, async () => {
  const setup = (w) => {
    const boom = () => { throw new w.Error("storage blocked"); };
    const stub = { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom };
    Object.defineProperty(stub, "length", { get: boom });
    Object.defineProperty(w, "localStorage", { get: () => stub, configurable: true });
  };
  const jobs = PAGES.map((page) => ({ label: page, run: () => check(page, { setup }, page + " (throwing storage)") }));
  const fails = await pool(jobs);
  assert.deepEqual(fails, [], fails.join("\n"));
});
