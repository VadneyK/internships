// Ticket r2-teen-flow-20: Interview and Paycheck give each jump-chip section a
// "Back to the list of parts" link that returns to the chip nav.
// Run with: node --test tests/r2-teen-flow-20-back-to-chips-interview-paycheck.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const pages = {
  "interview.html": ["availability", "practice", "ask", "references", "thanks"],
  "paycheck.html": ["est", "forms", "wrong", "bank"],
};

for (const [file, expectedIds] of Object.entries(pages)) {
  test(`${file}: chip nav has id parts and every chip target ends with one back link`, async () => {
    const { document, errors } = await loadPage(file);
    assert.deepEqual(errors, []);
    const nav = document.querySelector('nav.chips[aria-label="On this page"]');
    assert.ok(nav, "chip nav exists");
    assert.equal(nav.id, "parts", "chip nav id is parts");
    assert.equal(document.querySelectorAll("#parts").length, 1, "nav id is unique");
    const targets = [...nav.querySelectorAll("a.chip")].map((a) => a.getAttribute("href").slice(1));
    assert.deepEqual(targets, expectedIds);
    for (const id of targets) {
      const sec = document.getElementById(id);
      assert.ok(sec, `section #${id} exists`);
      const backs = [...sec.querySelectorAll("p.backtop.noprint")];
      assert.equal(backs.length, 1, `#${id} has one back paragraph`);
      const link = backs[0].querySelector("a");
      assert.ok(link, `#${id} back paragraph has a link`);
      assert.equal(link.getAttribute("href"), "#parts");
      assert.equal(link.textContent.trim(), "Back to the list of parts");
      const wrap = sec.querySelector(".wrap");
      assert.equal(wrap.lastElementChild, backs[0], `#${id} back link ends the section`);
    }
  });
}
