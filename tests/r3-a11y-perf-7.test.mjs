// Pages with no script of their own do not load lib.js; pages with one still load it before common.js.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const BARE = ["about.html", "contribute.html", "rules.html", "404.html"];
const srcs = (html) => [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);

for (const file of BARE) {
  test(file + ": no lib.js, common.js still loads, no errors, theme button works", async () => {
    assert.ok(!srcs(read(file)).some((s) => s.includes("lib.js")), "lib.js tag found in " + file);
    assert.ok(srcs(read(file)).some((s) => s.includes("common.js")), "common.js missing in " + file);
    const { window, document, errors } = await loadPage(file);
    assert.deepEqual(errors, []);
    assert.equal(window.TIG.lib, undefined);
    assert.equal(typeof window.TIG.toast, "function");
    assert.equal(typeof window.TIG.copy, "function");
    assert.equal(typeof window.TIG.markNewTabLinks, "function");
    assert.ok(window.TIG.store);
    const btn = document.getElementById("themeBtn");
    const before = btn.getAttribute("aria-pressed");
    btn.click();
    const after = btn.getAttribute("aria-pressed");
    assert.notEqual(before, after);
    assert.equal(document.documentElement.getAttribute("data-theme"), after === "true" ? "dark" : "light");
    btn.click();
    assert.equal(btn.getAttribute("aria-pressed"), before);
    window.close();
  });
}

test("rules.html: a target=_blank link still gets the hidden new-tab marker", async () => {
  const { window, document } = await loadPage("rules.html");
  const a = document.createElement("a");
  a.href = "https://example.org/"; a.target = "_blank"; a.textContent = "Example";
  document.querySelector("main").appendChild(a);
  window.TIG.markNewTabLinks(document);
  const m = a.querySelector("span.sr[data-newtab]");
  assert.ok(m, "marker span missing");
  assert.match(m.textContent, /\(opens in a new tab\)/);
  window.close();
});

test("about.html: its real new-tab link carries the marker without lib.js", async () => {
  const { window, document } = await loadPage("about.html");
  const links = document.querySelectorAll('main a[target="_blank"]');
  assert.ok(links.length > 0);
  for (const a of links) assert.ok(/opens in a new tab/i.test(a.getAttribute("aria-label") || "") || a.querySelector("span.sr[data-newtab]"));
  window.close();
});

test("every page with a scripts: field loads lib.js before common.js; every other page has no lib.js", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "src"))) {
    if (f.startsWith("_") || !f.endsWith(".html")) continue;
    const head = read("src/" + f).split("\n---\n")[0];
    const has = /^scripts:\s*\S/m.test(head);
    const s = srcs(read(f));
    const lib = s.findIndex((x) => x.includes("lib.js"));
    const common = s.findIndex((x) => x.includes("common.js"));
    if (has) {
      assert.ok(lib > -1 && lib < common, f + ": lib.js must come before common.js");
    } else {
      assert.equal(lib, -1, f + ": lib.js should not load");
    }
  }
});

test("layout uses the {{libscript}} token and common.js guards G.lib", () => {
  assert.match(read("src/_layout.html"), /\{\{libscript\}\}/);
  assert.match(read("assets/js/common.js"), /var L = G\.lib \|\| null/);
});
