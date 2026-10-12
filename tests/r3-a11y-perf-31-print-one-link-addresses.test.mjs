// Run with: node --test tests/r3-a11y-perf-31-print-one-link-addresses.test.mjs
// G.printOnly copies a block into #printRoot, outside <main>, so the "main a[href^=http]" print rule never reaches it.
// A printed permit packet or prep sheet needs the address after each official link too.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const SEL = '#printRoot a[href^="http"]:not(.btn):not(.noprint)::after';

function braceBody(css, i) {
  let d = 0;
  for (; i < css.length; i++) {
    if (css[i] === "{") d++;
    else if (css[i] === "}" && --d === 0) return i;
  }
  throw new Error("unclosed block");
}
function split(css) {
  let print = "", screen = "", pos = 0;
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    const open = m.index + m[0].length - 1, end = braceBody(css, open);
    screen += css.slice(pos, m.index);
    print += css.slice(open + 1, end);
    pos = end + 1;
    re.lastIndex = pos;
  }
  return { print, screen: screen + css.slice(pos) };
}

test("print-one addresses: @media print has a #printRoot rule that prints attr(href)", () => {
  const { print, screen } = split(CSS);
  const rules = [...print.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const rule = rules.find((r) => r[1].split(",").some((s) => s.trim() === SEL));
  assert.ok(rule, "no print rule covers " + SEL);
  assert.match(rule[2], /content:\s*" \(" attr\(href\) "\)"/);
  assert.ok(!screen.includes("#printRoot a[href"), "address rule must not appear on screen");
});

test("print-one addresses: printOnly keeps the https link, and the rule skips .noprint and .btn", async () => {
  const { window, document, errors } = await loadPage("about.html");
  assert.deepEqual(errors, []);
  const n = document.createElement("div");
  n.innerHTML = '<a id="a" href="https://example.gov/permit">Permit office</a> <a class="noprint" href="https://example.gov/skip">Skip</a> <a class="btn" href="https://example.gov/b">Btn</a>';
  window.TIG.printOnly(n, "Sheet");
  const root = document.getElementById("printRoot");
  assert.ok(root);
  const kept = root.querySelector('a[href="https://example.gov/permit"]');
  assert.ok(kept, "the https link must survive the copy");
  assert.equal(kept.getAttribute("href"), "https://example.gov/permit");
  assert.equal(kept.matches(SEL.replace(/::after$/, "")), true);
  assert.equal(root.querySelector("a.noprint").matches(SEL.replace(/::after$/, "")), false);
  assert.equal(root.querySelector("a.btn").matches(SEL.replace(/::after$/, "")), false);
});
