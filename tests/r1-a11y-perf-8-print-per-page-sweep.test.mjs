// Run with: node --test tests/r1-a11y-perf-8-print-per-page-sweep.test.mjs
// The whole print picture, page by page. On every built root page, beforeprint opens every <details> in main and afterprint
// puts each back as it was. style.css @media print hides the screen-only controls with display: none.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "404.html").sort();

function braceBody(css, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") { depth--; if (depth === 0) return css.slice(openIdx + 1, i); }
  }
  throw new Error("unclosed block in style.css");
}

// Selectors that sit in a display: none rule inside any @media print block.
function hiddenInPrint() {
  const set = new Set();
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(CSS))) {
    const body = braceBody(CSS, m.index + m[0].length - 1);
    const rule = /([^{}]+)\{([^{}]*)\}/g;
    let r;
    while ((r = rule.exec(body))) {
      if (!/display\s*:\s*none\b/.test(r[2])) continue;
      for (const s of r[1].split(",")) set.add(s.trim().replace(/\s+/g, " "));
    }
  }
  return set;
}

test("print CSS hides the screen-only controls with display: none", () => {
  const hidden = hiddenInPrint();
  const need = [".top", ".foot", ".toast", ".theme-btn", ".menu-btn", ".skip", "main nav.chips"];
  const missing = need.filter((s) => !hidden.has(s));
  assert.deepEqual(missing, [], "not hidden in @media print: " + missing.join(", "));
});

for (const file of PAGES) {
  test(file + ": beforeprint opens every details in main, afterprint restores each", async () => {
    const { window, document, dom } = await loadPage(file);
    try {
      const all = [...document.querySelectorAll("main details")];
      // Start mixed: some open, some closed, so a restore that opens or closes everything is caught.
      all.forEach((d, i) => { d.open = i % 2 === 0; });
      const before = all.map((d) => d.open);
      window.dispatchEvent(new window.Event("beforeprint"));
      const stuck = all.filter((d) => !d.open).map((d) => (d.querySelector("summary")?.textContent || "").trim().slice(0, 40));
      assert.deepEqual(stuck, [], file + ": details still closed after beforeprint: " + stuck.join(" | "));
      window.dispatchEvent(new window.Event("afterprint"));
      const after = all.map((d) => d.open);
      assert.deepEqual(after, before, file + ": details did not return to their original open state after afterprint");
    } finally { dom.window.close(); }
  });
}
