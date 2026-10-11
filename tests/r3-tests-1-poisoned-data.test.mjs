// Poisoned data sweep: HTML hidden in any data string must show as text, never run, on every page.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "<img src=x onerror=window.__pwn=1><b id=pwn-marker>x</b>";
const JS_URL = "javascript:alert(1)";
const PAGES = fs.readdirSync(ROOT).filter((n) => n.endsWith(".html") && n !== "404.html");
// Known gaps, found by this test: these pages write a url from data/*.json into href with G.esc only, not G.safeUrl, so a
// javascript: url in the data would become a live link. Today every data url is https, so nothing is exposed. The fix is
// G.safeUrl in each page script (assets/js/interview.js, languages.js, paycheck.js, permit.js, ready.js, safety.js,
// younger.js), which this ticket does not touch. Remove a page here once fixed; the last test fails if a gap closes.
const KNOWN_JS_LINKS = new Set(["interview.html", "languages.html", "paycheck.html", "permit.html", "ready.html", "safety.html", "younger.html"]);
const SHOWS_TEXT = ["find.html", "calendar.html", "index.html"];

const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.+\-Z]*)?$/;
const URL_KEY = /(^|_)(url|urls|link|href|source|src)$|url$/i;
const ID_KEY = /(^|_)ids?$/i;
const SLUG = /^[a-z0-9_.:\-\/]*$/;
const PLAIN_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

function poison(v, key) {
  if (typeof v === "string") {
    if (ID_KEY.test(key || "") || ISO.test(v)) return v;
    if (URL_KEY.test(key || "") || PLAIN_URL.test(v)) return JS_URL;
    if (SLUG.test(v)) return v; // codes the page logic matches on (paid, confirmed-2026-27, ca) stay as they are
    return v + MARK;
  }
  if (Array.isArray(v)) return v.map((x) => poison(x, key));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = poison(x, k);
    return o;
  }
  return v;
}

function setup(w) {
  let base;
  Object.defineProperty(w, "fetch", {
    configurable: true,
    get() {
      return (u, o) => Promise.resolve(base(u, o)).then((r) => {
        if (!/\/data\/[^/]+\.json(\?|$)/.test(String(r.url || u))) return r;
        return r.text().then((t) => new Response(JSON.stringify(poison(JSON.parse(t))), { status: 200, headers: { "Content-Type": "application/json" } }));
      });
    },
    set(f) { base = f; },
  });
}

const SKIP_BTN = /print|download|reset|clear|delete|remove|copy|share|email/i;

async function drive(window, document) {
  for (let round = 0; round < 2; round++) {
    for (const sel of [...document.querySelectorAll("select")]) {
      const opts = [...sel.options].filter((o) => !o.disabled);
      if (opts.length < 2) continue;
      sel.value = opts[Math.min(round + 1, opts.length - 1)].value;
      sel.dispatchEvent(new window.Event("input", { bubbles: true }));
      sel.dispatchEvent(new window.Event("change", { bubbles: true }));
      await tick(10);
    }
    for (const d of document.querySelectorAll("details")) d.open = true;
    const btns = [...document.querySelectorAll("button, [role=tab], summary, [role=radio]")].slice(0, 80);
    for (const b of btns) {
      if (!b.isConnected || b.disabled || SKIP_BTN.test(b.textContent || "")) continue;
      try { b.click(); } catch (e) { /* ignore */ }
      await tick(2);
    }
    await tick(40);
  }
}

const jsLinkPages = new Map();

test("poisoned data strings render as text and never run", async () => {
  for (const page of PAGES) {
    const p = await loadPage(page, { setup, now: Date.UTC(2026, 9, 10, 15, 0, 0) });
    const { window, document } = p;
    try {
      const scriptsBefore = document.querySelectorAll("script").length;
      let seen = document.body.textContent;
      await drive(window, document);
      seen += document.body.textContent;
      assert.equal(window.__pwn, undefined, page + ": payload ran");
      assert.equal(document.getElementById("pwn-marker"), null, page + ": payload became an element");
      assert.equal(document.querySelectorAll("img[src='x']").length, 0, page + ": injected img");
      assert.equal(document.querySelectorAll("script").length, scriptsBefore, page + ": new script element");
      const bad = [...document.querySelectorAll("a[href]")].filter((a) => /^\s*javascript:/i.test(a.getAttribute("href")));
      if (bad.length) jsLinkPages.set(page, bad[0].outerHTML.slice(0, 100));
      if (SHOWS_TEXT.includes(page)) {
        assert.ok(seen.includes("<img src=x onerror"), page + ": escaped payload text not visible");
      }
    } finally { window.close(); }
  }
});

test("javascript: data urls never become links, except the known gaps", () => {
  const found = [...jsLinkPages.keys()].sort();
  const unexpected = found.filter((f) => !KNOWN_JS_LINKS.has(f));
  assert.deepEqual(unexpected, [], "javascript: link on " + unexpected.map((f) => f + " " + jsLinkPages.get(f)).join(" | "));
  const stale = [...KNOWN_JS_LINKS].filter((f) => !jsLinkPages.has(f));
  assert.deepEqual(stale, [], "gap closed, remove from KNOWN_JS_LINKS");
});
