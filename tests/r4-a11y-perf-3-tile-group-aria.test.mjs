// Group tiles in a tap picker say expanded, never pressed. Only the chosen leaf tile is pressed.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const page of ["find.html", "index.html"]) {
  test(page + ": group tiles use aria-expanded and aria-controls, not aria-pressed", async () => {
    const { window, document, errors } = await loadPage(page);
    await wait(250);
    const groups = [...document.querySelectorAll(".tp .tp-row > .tile[aria-expanded]")];
    if (page === "find.html") assert.ok(groups.length > 1, "find.html has grouped tiles");
    if (!groups.length) { window.close(); return; }
    for (const g of groups) {
      assert.equal(g.hasAttribute("aria-pressed"), false, "group tile has aria-pressed");
      const id = g.getAttribute("aria-controls");
      assert.ok(id, "group tile has aria-controls");
      const sub = document.getElementById(id);
      assert.ok(sub && sub.classList.contains("tp-sub"), "aria-controls points at a .tp-sub");
    }
    const g = groups[0];
    g.click();
    const g2 = document.getElementById(g.getAttribute("aria-controls")) && [...document.querySelectorAll(".tp .tp-row > .tile[aria-expanded]")].find((b) => b.textContent === g.textContent);
    assert.equal(g2.getAttribute("aria-expanded"), "true");
    const sub = document.getElementById(g2.getAttribute("aria-controls"));
    assert.equal(sub.hidden, false);
    const cities = [...sub.querySelectorAll(".tile")];
    assert.ok(cities.length);
    cities.forEach((c) => assert.ok(["true", "false"].includes(c.getAttribute("aria-pressed"))));
    const text = cities[cities.length - 1].textContent;
    cities[cities.length - 1].click();
    const after = [...document.querySelectorAll(".tp-sub .tile")].find((b) => b.textContent === text && b.getAttribute("aria-pressed") === "true");
    assert.ok(after, "picked city is pressed");
    const grp = [...document.querySelectorAll(".tp .tp-row > .tile[aria-expanded]")].find((b) => b.textContent === g.textContent);
    assert.equal(grp.getAttribute("aria-expanded"), "true");
    assert.equal(grp.hasAttribute("aria-pressed"), false);
    assert.deepEqual(errors, []);
    window.close();
  });
}
