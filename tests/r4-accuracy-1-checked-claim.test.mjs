// The parents and about pages must not say every card was checked against its own page.
// data/meta.json says 1764 of 1771 programs were read on the official site, so the pages
// say "where it could be read" and point to "Confirm first" or "Based on last year" (ticket r2-accuracy-1).
// Run with: node --test tests/r4-accuracy-1-checked-claim.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const SRC_PARENTS = rd("src/parents.html");
const SRC_ABOUT = rd("src/about.html");
const ROOT_PARENTS = rd("parents.html");
const ROOT_ABOUT = rd("about.html");

const BANNED_PARENTS = "every card was checked";
const BANNED_ABOUT = "For each program we opened";
const QUALIFIER = "where it could be read";

// Text of the sentence(s) starting at the phrase, up to the next period.
const sentenceAt = (html, phrase) => {
  const i = html.indexOf(phrase);
  if (i < 0) return null;
  const end = html.indexOf(".", i);
  return html.slice(i, end < 0 ? undefined : end + 1);
};

test("parents page no longer says every card was checked, and says what happens when it could not be", () => {
  for (const html of [SRC_PARENTS, ROOT_PARENTS]) {
    assert.ok(!html.includes(BANNED_PARENTS), "still says 'every card was checked'");
    assert.ok(html.includes("Cards were checked against their own page where that page could be read."),
      "missing the qualified checked sentence");
    assert.ok(html.includes("Confirm first") && html.includes("Based on last year"),
      "missing the Confirm first / Based on last year explanation");
    assert.ok(html.includes("when it could not be read"), "missing the 'when it could not be read' clause");
  }
});

test("about page qualifies 'For each program we opened its own website'", () => {
  for (const html of [SRC_ABOUT, ROOT_ABOUT]) {
    const s = sentenceAt(html, BANNED_ABOUT);
    assert.ok(s, "about page lost the 'For each program we opened' sentence");
    assert.ok(s.includes(QUALIFIER), "unqualified claim: " + s);
  }
});

test("no unqualified 'For each program we opened' anywhere in src or root about page", () => {
  for (const html of [SRC_ABOUT, ROOT_ABOUT]) {
    for (let i = html.indexOf(BANNED_ABOUT); i >= 0; i = html.indexOf(BANNED_ABOUT, i + 1)) {
      const s = sentenceAt(html, html.slice(i, i + BANNED_ABOUT.length));
      assert.ok(s.includes(QUALIFIER), "unqualified claim: " + s);
    }
  }
});

test("built root pages match the src wording for both claims", () => {
  const pairs = [
    [SRC_PARENTS, ROOT_PARENTS, "Cards were checked against their own page where that page could be read."],
    [SRC_ABOUT, ROOT_ABOUT, "For each program we opened its own website where it could be read, and copied down"],
  ];
  for (const [src, root, sentence] of pairs) {
    assert.ok(src.includes(sentence), "src is missing: " + sentence);
    assert.ok(root.includes(sentence), "root page is out of date with src: " + sentence);
  }
});

test("neither page contains an em dash or en dash in the edited claims", () => {
  for (const html of [SRC_PARENTS, SRC_ABOUT, ROOT_PARENTS, ROOT_ABOUT]) {
    assert.ok(!/[\u2013\u2014]/.test(html), "dash character found");
  }
});
