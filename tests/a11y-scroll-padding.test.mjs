// Ticket r1-a11y-perf-2: a keyboard user who Tabs to a link, chip or input with no id must not land under the sticky header.
// The header is position: sticky on screens wider than 40rem and position: static at 40rem and under, so the
// scroll padding only belongs in a min-width block of 40rem or more. Reads style.css as text (comments stripped).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = stripComments(fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8"));

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Every @media block in the sheet, with its query text and its body (brace matched).
function mediaBlocks(css) {
  const out = [];
  const re = /@media\s*([^{]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out.push({ query: m[1].trim(), body: css.slice(re.lastIndex, i - 1) });
  }
  return out;
}

function minWidthRem(query) {
  const m = /\(\s*min-width:\s*([\d.]+)rem\s*\)/.exec(query);
  return m ? parseFloat(m[1]) : null;
}

// True when a min-width block of 40rem or more, not print, sets scroll-padding-top of at least 5rem on html or :root.
function hasDesktopScrollPadding(css) {
  return mediaBlocks(css).some((block) => {
    const min = minWidthRem(block.query);
    if (min === null || min < 40) return false;
    if (/\bprint\b/i.test(block.query)) return false;
    const rule = /(?:^|[}\s;])(?:html|:root)\s*\{([^}]*)\}/g;
    let r;
    while ((r = rule.exec(block.body))) {
      const decl = /scroll-padding-top:\s*([\d.]+)rem/.exec(r[1]);
      if (decl && parseFloat(decl[1]) >= 5) return true;
    }
    return false;
  });
}

test("desktop-only scroll padding under the sticky header is present", () => {
  assert.ok(hasDesktopScrollPadding(CSS), "need html or :root scroll-padding-top >= 5rem inside a min-width (>= 40rem) media block, not print");
});

test("the scroll padding rule is not inside a print block", () => {
  const printBlocks = mediaBlocks(CSS).filter((b) => /\bprint\b/i.test(b.query));
  for (const b of printBlocks) {
    assert.ok(!/scroll-padding-top/.test(b.body), "scroll-padding-top must not be set inside @media print");
  }
});

test("the existing jump-link scroll margin rule is still present", () => {
  assert.match(CSS, /main \[id\], \.prog\s*\{\s*scroll-margin-top:\s*5rem;?\s*\}/);
});

test("the header is still sticky on wide screens", () => {
  assert.match(CSS, /\.top\s*\{\s*position:\s*sticky/);
});

test("the 40rem and under block still makes the header static", () => {
  const small = mediaBlocks(CSS).filter((b) => /max-width:\s*40rem/.test(b.query));
  assert.ok(small.some((b) => /\.top\s*\{\s*position:\s*static/.test(b.body)), "max-width: 40rem block must set .top { position: static");
});

test("mutation: removing the scroll padding rule makes the check fail", () => {
  const mutated = CSS.replace(/scroll-padding-top:\s*[\d.]+rem;?/g, "");
  assert.equal(hasDesktopScrollPadding(mutated), false);
});

test("mutation: setting the scroll padding to 2rem makes the check fail", () => {
  const mutated = CSS.replace(/scroll-padding-top:\s*[\d.]+rem/g, "scroll-padding-top: 2rem");
  assert.equal(hasDesktopScrollPadding(mutated), false);
});

test("mutation: moving the rule into a print block makes the check fail", () => {
  const rule = /@media \(min-width: 40\.0625rem\) \{ html \{ scroll-padding-top: 5rem; \} \}/;
  assert.ok(rule.test(CSS), "expected the shipped rule text in style.css");
  const mutated = CSS.replace(rule, "@media print { html { scroll-padding-top: 5rem; } }");
  assert.equal(hasDesktopScrollPadding(mutated), false);
});
