// Ticket r3-teen-flow-6: each section a jump chip points to ends with "Back to the list of parts".
// Run with: node --test tests/r3-teen-flow-14-back-to-chips.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");

for (const file of ["ready.html", "playbook.html", "rules.html", "states.html"]) {
  test(`${file}: every chip target has a back link to the chip nav`, async () => {
    const { document, errors } = await loadPage(file);
    assert.deepEqual(errors, []);
    const nav = document.querySelector('nav.chips[aria-label="On this page"]');
    assert.ok(nav && nav.id, "chip nav has an id");
    assert.equal(document.querySelectorAll("#" + nav.id).length, 1, "nav id is unique");
    const targets = [...nav.querySelectorAll("a.chip")].map((a) => a.getAttribute("href").slice(1));
    assert.ok(targets.length >= 4);
    for (const id of targets) {
      const sec = document.getElementById(id);
      assert.ok(sec, `section #${id} exists`);
      const links = [...sec.querySelectorAll("p.backtop a")];
      assert.equal(links.length, 1, `#${id} has one back link`);
      assert.equal(links[0].getAttribute("href"), "#" + nav.id);
      assert.equal(links[0].textContent.trim(), "Back to the list of parts");
      assert.ok(links[0].closest(".noprint"), `#${id} back link is hidden on print`);
      assert.equal(sec.querySelector("h1,h2,h3,h4") && sec.querySelector("h2").textContent.length > 0, true);
    }
  });
}

test("style.css makes the back link at least 2.75rem tall", () => {
  assert.match(css, /\.backtop a\s*\{[^}]*min-height:\s*2\.75rem/);
});
