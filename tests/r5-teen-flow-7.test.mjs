// Ticket r1-teen-flow-7 (test, size S): every teen page links onward to other teen pages,
// and every in-page jump link has a target on the same page.
// Run with: node --test tests/r5-teen-flow-7.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const TEEN_PAGES = [
  "find.html",
  "permit.html",
  "interview.html",
  "paycheck.html",
  "younger.html",
  "calendar.html",
  "ready.html",
  "playbook.html",
  "resume.html",
  "safety.html",
];

// Turn an href into the page file it points to, or null when it stays on the same page.
function targetPage(href) {
  const clean = href.split("#")[0].split("?")[0].replace(/^\.\//, "").replace(/^\/+/, "");
  return clean === "" ? null : clean;
}

for (const page of TEEN_PAGES) {
  test(`r5-teen-flow-7: ${page} jump links in main each have a matching id on the page`, async () => {
    const { document } = await loadPage(page);
    await tick(200); // some chip rows and links are filled by script

    const main = document.querySelector("main");
    assert.ok(main, `${page}: page has a main element`);

    const jumps = [...main.querySelectorAll('a[href^="#"]')].filter((a) => a.getAttribute("href") !== "#");
    for (const a of jumps) {
      const href = a.getAttribute("href");
      const id = href.slice(1);
      const found = id !== "" && document.getElementById(id) !== null;
      assert.ok(found, `${page}: jump link ${href} has no element with id "${id}"`);
    }
  });

  test(`r5-teen-flow-7: ${page} main links onward to at least two other teen pages`, async () => {
    const { document } = await loadPage(page);
    await tick(200);

    const main = document.querySelector("main");
    assert.ok(main, `${page}: page has a main element`);

    const others = new Set();
    for (const a of main.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      const target = targetPage(href);
      if (target && target !== page && TEEN_PAGES.includes(target)) others.add(target);
    }
    assert.ok(
      others.size >= 2,
      `${page}: main links to ${others.size} other teen page(s) (${[...others].join(", ") || "none"}); need at least 2`,
    );
  });
}
