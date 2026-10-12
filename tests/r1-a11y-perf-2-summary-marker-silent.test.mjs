// Run with: node --test tests/r1-a11y-perf-2-summary-marker-silent.test.mjs
// Locks in the silent accordion marker in assets/css/style.css. Chrome and Safari read generated
// content aloud, so the plus and minus marks on main details > summary must use the alt-text form
// (content: "<visible>" / "") with an empty alternative. The open state is already announced by the
// details element. The print rule that hides the marks must still be present, inside @media print.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
// Comments removed so their text never reads as a selector or a declaration.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

// Returns every rule body whose selector is exactly the given text, with its index in CSS.
function rulesFor(selector) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(CSS)) !== null) {
    if (m[1].trim() === selector) out.push({ body: m[2], index: m.index });
  }
  return out;
}

// Returns the last content declaration in the body. The rule holds a plain fallback first
// (content: "+";) and the alt-text form second; browsers that read alt text apply the last one.
function contentOf(body) {
  const all = [...body.matchAll(/content\s*:\s*([^;]+);/g)];
  return all.length ? all[all.length - 1][1].trim() : null;
}

const SCREEN_CLOSED = "main details > summary::after";
const SCREEN_OPEN = "main details[open] > summary::after";

test("closed marker uses the alt-text form with an empty alternative", () => {
  const rules = rulesFor(SCREEN_CLOSED).filter((r) => contentOf(r.body) !== "none");
  assert.equal(rules.length, 1, "exactly one screen rule for main details > summary::after");
  assert.match(contentOf(rules[0].body), /^"\+"\s*\/\s*""$/, 'content must be "+" / ""');
});

test("open marker uses the alt-text form with an empty alternative", () => {
  const rules = rulesFor(SCREEN_OPEN).filter((r) => contentOf(r.body) !== "none");
  assert.equal(rules.length, 1, "exactly one screen rule for main details[open] > summary::after");
  assert.match(contentOf(rules[0].body), /^"\\2212"\s*\/\s*""$/, 'content must be "\\2212" / ""');
});

test("every screen content value on these markers has a slash alternative", () => {
  for (const sel of [SCREEN_CLOSED, SCREEN_OPEN]) {
    for (const r of rulesFor(sel)) {
      const value = contentOf(r.body);
      if (value === null || value === "none") continue;
      assert.ok(value.includes("/"), `${sel} content has no slash alternative: ${value}`);
      const alt = value.split("/")[1].trim();
      assert.equal(alt, '""', `${sel} alternative text must be empty, got ${alt}`);
    }
  }
});

test("print rule still hides the markers and sits inside @media print", () => {
  const printRules = rulesFor(SCREEN_CLOSED).filter((r) => contentOf(r.body) === "none");
  assert.equal(printRules.length, 1, "print rule main details > summary::after { content: none } is present");
  // Find the @media print block that opens before the rule and check its braces close after it.
  const idx = printRules[0].index;
  let found = false;
  let from = CSS.lastIndexOf("@media", idx);
  while (from !== -1 && !found) {
    if (/^@media\s+print\b/.test(CSS.slice(from))) {
      const open = CSS.indexOf("{", from);
      let depth = 0;
      for (let i = open; i < CSS.length; i++) {
        if (CSS[i] === "{") depth++;
        else if (CSS[i] === "}") {
          depth--;
          if (depth === 0) {
            found = i > idx;
            break;
          }
        }
      }
      break;
    }
    from = CSS.lastIndexOf("@media", from - 1);
  }
  assert.ok(found, "the print rule must sit inside an @media print block");
});
