// Tap targets for details summaries (ticket r2-a11y-perf-3): every summary in <main> is at least 2.75rem tall.
// Run with: node --test tests/r2-a11y-perf-3-summary-tap-target.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");

// Comments removed, then every @media print block removed (matching braces), so only screen rules remain.
function screenCss(text) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, "");
  let at;
  while ((at = out.search(/@media\s+print\s*\{/)) >= 0) {
    let depth = 0;
    let end = -1;
    for (let i = out.indexOf("{", at); i < out.length; i++) {
      if (out[i] === "{") depth++;
      else if (out[i] === "}" && --depth === 0) { end = i + 1; break; }
    }
    if (end < 0) break;
    out = out.slice(0, at) + out.slice(end);
  }
  return out;
}

// Every rule block as { selectors: [...], body: "..." }, in file order.
function rules(text) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith("@")) continue;
    out.push({ selectors: sel.split(",").map((s) => s.replace(/\s+/g, " ").trim()), body: m[2] });
  }
  return out;
}

// Declarations from every screen rule whose selector list contains the exact selector; later rules win.
function declarations(selector) {
  const decl = {};
  for (const r of rules(screenCss(css))) {
    if (!r.selectors.includes(selector)) continue;
    for (const d of r.body.split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decl[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  return decl;
}

const rem = (v) => {
  const m = /^(\d*\.?\d+)rem$/.exec(v || "");
  return m ? parseFloat(m[1]) : NaN;
};

test("style.css gives every 'main details > summary' a min-height of at least 2.75rem", () => {
  const d = declarations("main details > summary");
  assert.ok(rem(d["min-height"]) >= 2.75, "min-height is " + d["min-height"]);
});

test("style.css lays 'main details > summary' out as flex with items centred", () => {
  const d = declarations("main details > summary");
  assert.ok(d.display === "flex" || d.display === "inline-flex", "display is " + d.display);
  assert.equal(d["align-items"], "center");
});

test("style.css keeps the .acc summary and .prog summary rules", () => {
  assert.ok(declarations(".acc summary")["padding"], ".acc summary rule is missing or has no padding");
  assert.ok(declarations(".prog summary")["padding"], ".prog summary rule is missing or has no padding");
});

test("ready.html: every main details has a direct summary child with non-empty text", async () => {
  const page = await loadPage("ready.html");
  const details = [...page.document.querySelectorAll("main details")];
  assert.ok(details.length > 0, "ready.html has no details inside main");
  details.forEach((d, i) => {
    const first = [...d.children].find((c) => c.tagName === "SUMMARY");
    assert.ok(first, "details #" + i + " has no direct summary child");
    assert.ok(first.textContent.trim().length > 0, "details #" + i + " summary is empty");
  });
});
