// Ticket r1-teen-flow-6: every built root page that has a "Back to the list of parts" link
// has a chip nav with id "parts", and every back link points at #parts and sits outside the
// #words details and outside the print-only block. Pages without nav#parts have no back links.
// Pages with a known gap are named in ALLOW below with a reason. Each allow entry must still be
// a real gap, so the entry is removed once the gap is fixed.
// Run with: node --test tests/r1-teen-flow-23-parts-backtop-consistency.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACK_TEXT = "Back to the list of parts";

// page -> reason it is exempt from the pattern for now
const ALLOW = {
  "resume.html": "Has jump chips but no nav#parts and no back links. Gap until r1-teen-flow-3 lands.",
};

const pages = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort();

function load(file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  return new JSDOM(html).window.document;
}

test("the allow list only names real root pages", () => {
  for (const file of Object.keys(ALLOW)) {
    assert.ok(pages.includes(file), `${file} exists at the repo root`);
    assert.ok(ALLOW[file].length > 20, `${file} has a reason`);
  }
});

for (const file of pages) {
  test(`${file}: parts nav and back links follow the pattern`, () => {
    const doc = load(file);
    const nav = doc.querySelector('nav#parts');
    const backLinks = [...doc.querySelectorAll("p.backtop a")];
    const textLinks = [...doc.querySelectorAll("a")].filter((a) => a.textContent.trim() === BACK_TEXT);

    if (ALLOW[file]) {
      // Exempt, but the gap must still be there so the allow entry does not go stale.
      assert.equal(nav, null, `${file} still lacks nav#parts, so the allow entry is still needed`);
      return;
    }

    if (!nav) {
      assert.equal(backLinks.length, 0, `${file} has no nav#parts, so it must have no backtop links`);
      assert.equal(textLinks.length, 0, `${file} has no nav#parts, so it must not have "${BACK_TEXT}" links`);
      return;
    }

    assert.equal(doc.querySelectorAll("#parts").length, 1, `${file} has one #parts id`);
    for (const a of backLinks) {
      assert.equal(a.getAttribute("href"), "#parts", `${file} backtop links to #parts`);
      assert.equal(a.closest("#words"), null, `${file} backtop is not inside details#words`);
      assert.equal(a.closest(".printonly"), null, `${file} backtop is not inside .printonly`);
    }
    for (const a of textLinks) {
      assert.equal(a.getAttribute("href"), "#parts", `${file} "${BACK_TEXT}" links to #parts`);
    }
  });
}

test("pages with a parts nav are the expected set", () => {
  const withNav = pages.filter((f) => load(f).querySelector("nav#parts"));
  assert.ok(withNav.length >= 8, `at least 8 pages have nav#parts, found ${withNav.length}`);
  assert.ok(withNav.includes("ready.html") && withNav.includes("safety.html"));
});
