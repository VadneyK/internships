// lib.js (44 KB of filter, date and permit logic) loads only on built pages that read it.
// A page loads lib.js when its own script uses one of the lib names (G.esc, G.lib, G.fillPlaces, ...), or when a
// common.js feature that needs lib.js is on the page (a .share-parent with data-share, or a tap-tile picker).
// Share and Leaders read none of it, so their headers say `lib: none` and they must not load it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB_NAMES = /\b(?:G|TIG)\.(?:esc|safeUrl|parseISO|fmtDate|daysUntil|lib|fillPlaces|placeTiles|REGIONS|HUBS|TYPES|FIELDS|PAID)\b/;
const PICKER_CALLS = /\b(?:G|TIG)\.(?:tilePicker|autoTiles)\b/;

function scriptsOf(html) {
  return [...html.matchAll(/<script src="assets\/js\/([\w-]+)\.js\?v=[^"]*"><\/script>/g)].map((m) => m[1]);
}
function hasShareParent(html) {
  return [...html.matchAll(/<[^>]+>/g)].some((m) => /\bclass="[^"]*\bshare-parent\b/.test(m[0]) && /\sdata-share=/.test(m[0]));
}
function needsLib(html) {
  const own = scriptsOf(html).filter((s) => s !== "common" && s !== "lib");
  const ownText = own.map((s) => fs.readFileSync(path.join(ROOT, "assets", "js", s + ".js"), "utf8")).join("\n");
  return LIB_NAMES.test(ownText) || PICKER_CALLS.test(ownText) || hasShareParent(html) || /\sdata-tiles(\s|=|>)/.test(html);
}
function pages() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort().map((f) => ({ file: f, html: fs.readFileSync(path.join(ROOT, f), "utf8") }));
}

test("every built root page loads lib.js exactly when it needs it", () => {
  const bad = [];
  let needing = 0;
  for (const { file, html } of pages()) {
    const loads = /assets\/js\/lib\.js\?v=/.test(html);
    const need = needsLib(html);
    if (need) needing++;
    if (need && !loads) bad.push(file + " uses lib names or a lib-backed feature but does not load lib.js");
    if (!need && loads) bad.push(file + " loads lib.js but uses none of it (no lib names, no share-parent, no tap tiles)");
  }
  assert.ok(needing >= 10, "the scan should find the pages that use lib.js, found " + needing);
  assert.deepEqual(bad, []);
});

test("share.html and leaders.html carry the lib: none header and do not load lib.js", () => {
  for (const f of ["share.html", "leaders.html"]) {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.doesNotMatch(html, /assets\/js\/lib\.js/, f);
    assert.match(fs.readFileSync(path.join(ROOT, "src", f), "utf8").split("\n---\n")[0], /^lib:\s*none\s*$/m, "src/" + f + " header");
    assert.ok(scriptsOf(html).includes("common") && scriptsOf(html).length === 2, f + " loads only common.js and its own script");
  }
});

test("build.py omits the lib.js tag when a page header says lib: none", () => {
  const build = fs.readFileSync(path.join(ROOT, "tools", "build.py"), "utf8");
  assert.match(build, /fields\.get\("lib",\s*""\)\.strip\(\)\s*!=\s*"none"/);
});

test("share and leaders load in jsdom with no console error, and Copy and Print still work without lib.js", async () => {
  const copied = [];
  const setupClipboard = (w) => {
    Object.defineProperty(w.navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { copied.push(t); } } });
  };

  const share = await loadPage("share.html", { setup: setupClipboard }); await tick(100);
  assert.deepEqual(share.errors, []);
  assert.equal(share.document.querySelector('script[src*="lib.js"]'), null);
  share.document.getElementById("copyShareMsg").click(); await tick(20);
  assert.equal(copied.at(-1), share.document.getElementById("shareMsg").textContent);
  share.document.querySelector('[data-print-qr="home"]').click(); await tick(20);
  assert.equal(share.window.__printed, 1, "share print button calls print once");
  assert.equal(share.document.getElementById("qrPrint").hidden, true);

  const leaders = await loadPage("leaders.html", { setup: setupClipboard }); await tick(100);
  assert.deepEqual(leaders.errors, []);
  assert.equal(leaders.document.querySelector('script[src*="lib.js"]'), null);
  const copyBtn = leaders.document.querySelector("[data-copy]");
  assert.ok(copyBtn, "leaders has a copy button");
  copyBtn.click(); await tick(20);
  assert.equal(copied.at(-1), leaders.document.getElementById(copyBtn.getAttribute("data-copy")).textContent);
  const printBtn = leaders.document.querySelector("[data-print]");
  assert.ok(printBtn, "leaders has a print button");
  printBtn.click(); await tick(20);
  assert.equal(leaders.window.__printed, 1, "leaders print button calls print once");
  assert.deepEqual(leaders.errors, []);
});
