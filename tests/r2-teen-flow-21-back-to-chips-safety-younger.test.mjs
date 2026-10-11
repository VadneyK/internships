// Ticket r2-teen-flow-21: safety.html and younger.html each have a chip nav with id "parts",
// and every chip target that is a section ends with "Back to the list of parts".
// The #words chip targets a details element and is skipped on purpose.
// Run with: node --test tests/r2-teen-flow-21-back-to-chips-safety-younger.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const PAGES = {
  "safety.html": { minTargets: 7, ignore: ["words"] },
  "younger.html": { minTargets: 4, ignore: ["words"] },
};

for (const [file, cfg] of Object.entries(PAGES)) {
  test(`${file}: every section chip target has a back link to the chip nav`, async () => {
    const { document, errors } = await loadPage(file);
    assert.deepEqual(errors, []);
    const nav = document.querySelector('nav.chips[aria-label="On this page"]');
    assert.ok(nav && nav.id, "chip nav has an id");
    assert.equal(nav.id, "parts", "chip nav id is parts");
    assert.equal(document.querySelectorAll("#parts").length, 1, "nav id is unique");
    const targets = [...nav.querySelectorAll("a.chip")]
      .map((a) => a.getAttribute("href").slice(1))
      .filter((id) => !cfg.ignore.includes(id));
    assert.ok(targets.length >= cfg.minTargets, `at least ${cfg.minTargets} section targets`);
    for (const id of targets) {
      const sec = document.getElementById(id);
      assert.ok(sec, `section #${id} exists`);
      assert.notEqual(sec.tagName, "DETAILS", `#${id} is a section, not a details`);
      const links = [...sec.querySelectorAll("p.backtop a")];
      assert.equal(links.length, 1, `#${id} has one back link`);
      assert.equal(links[0].getAttribute("href"), "#parts");
      assert.equal(links[0].textContent.trim(), "Back to the list of parts");
      assert.ok(links[0].closest(".noprint"), `#${id} back link is hidden on print`);
      assert.ok(sec.querySelector("h2") && sec.querySelector("h2").textContent.length > 0, `#${id} has a heading`);
    }
  });

  test(`${file}: the #words chip target is skipped, not given a back link`, async () => {
    const { document } = await loadPage(file);
    const words = document.getElementById("words");
    assert.ok(words, "#words exists");
    assert.equal(words.tagName, "DETAILS");
    assert.equal(words.querySelectorAll("p.backtop").length, 0);
  });
}
