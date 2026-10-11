// Footer quick links: each link is a 2.75rem (44px) tap target, the same size as every other control on the site.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const css = fs.readFileSync(path.join(root, "assets/css/style.css"), "utf8");

// Every rule block as { selectors: [...], body: "..." }, in file order (same helper as r1-a11y-perf-5-tap-targets).
function rules(text) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!sel || sel.startsWith("@")) continue;
    out.push({ selectors: sel.split(",").map((s) => s.replace(/\s+/g, " ").trim()), body: m[2] });
  }
  return out;
}

// Declarations from every rule whose selector list contains the exact selector, later rules win.
function declarations(selector) {
  const decl = {};
  for (const r of rules(css)) {
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

test("style.css gives '.foot li a' a min-height of at least 2.75rem", () => {
  const d = declarations(".foot li a");
  assert.equal(d.display, "inline-flex");
  assert.ok(rem(d["min-height"]) >= 2.75, "min-height is " + d["min-height"]);
});

test("style.css no longer carries the stale '36px' footer comment", () => {
  assert.doesNotMatch(css, /about 36px/);
});

test("every built root page has a .foot .qlinks list with one link per li", () => {
  const files = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
  let checked = 0;
  for (const f of files) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, f), "utf8"));
    const lists = [...dom.window.document.querySelectorAll(".foot ul.qlinks")];
    if (!lists.length) continue;
    checked++;
    for (const ul of lists) {
      const items = [...ul.children];
      assert.ok(items.length > 0, f + " has an empty .foot .qlinks list");
      for (const li of items) {
        assert.equal(li.tagName, "LI", f + " .qlinks has a non-li child");
        assert.ok(li.querySelector(":scope > a"), f + " footer li has no link: " + li.textContent.trim());
      }
    }
  }
  assert.ok(checked > 0, "no built page has a .foot .qlinks list");
});
