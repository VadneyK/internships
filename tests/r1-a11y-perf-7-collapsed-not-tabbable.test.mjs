// Collapsed things are not tab stops: the phone Menu hides the nav links, and closed sub-panels and closed details hide their contents.
// jsdom does not run media queries, so the phone query is mocked, and the phone rule is read from style.css and applied to the page.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");
const PHONE_QUERY = "(max-width: 40rem)";
const at = css.indexOf("@media " + PHONE_QUERY);
assert.ok(at > -1, "style.css has the phone media block");
const block = css.slice(at, css.indexOf("\n}", at));
const hideRule = (block.match(/\.top\.menu-js \.nav\s*\{[^}]*\}/) || [])[0];
const openRule = (block.match(/\.top\.menu-js\.open \.nav\s*\{[^}]*\}/) || [])[0];

function phone(w) {
  w.innerWidth = 390;
  w.matchMedia = (q) => ({ matches: q.replace(/\s+/g, "") === PHONE_QUERY.replace(/\s+/g, ""), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}

test("the phone rules hide the nav behind the menu-js class", () => {
  assert.ok(hideRule && /display:\s*none/.test(hideRule), "menu-js nav is display:none on a phone");
  assert.ok(openRule && /display:\s*flex/.test(openRule), "open menu shows the nav");
});

for (const file of ["index.html", "find.html", "playbook.html", "ready.html"]) {
  test(file + ": phone menu starts closed, opens on click, Escape closes and returns focus", async () => {
    const { window, document } = await loadPage(file, { setup: phone });
    await tick(100);
    const style = document.createElement("style");
    style.textContent = hideRule + "\n" + openRule + "\n.menu-btn{display:inline-flex}";
    document.head.appendChild(style);
    const m = document.querySelector("button.menu-btn");
    assert.ok(m, "Menu button exists");
    const nav = document.getElementById(m.getAttribute("aria-controls"));
    assert.ok(nav, "aria-controls points at the nav");
    assert.ok(nav.querySelector("a"), "nav has links");
    const hidden = () => nav.hidden || window.getComputedStyle(nav).display === "none";
    assert.equal(m.getAttribute("aria-expanded"), "false");
    assert.ok(hidden(), "nav is hidden before any click");
    m.click();
    assert.equal(m.getAttribute("aria-expanded"), "true");
    assert.ok(!hidden(), "nav shows when open");
    nav.querySelector("a").focus();
    nav.querySelector("a").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(m.getAttribute("aria-expanded"), "false");
    assert.ok(hidden(), "nav hidden again after Escape");
    assert.equal(document.activeElement, m, "focus is on the Menu button");
  });

  test(file + ": every collapsed aria-expanded button controls a hidden panel", async () => {
    const { document } = await loadPage(file, { setup: phone });
    await tick(100);
    for (const b of document.querySelectorAll('[aria-expanded][aria-controls]')) {
      const panel = document.getElementById(b.getAttribute("aria-controls"));
      assert.ok(panel, b.getAttribute("aria-controls") + " exists");
      if (b.getAttribute("aria-expanded") === "false") {
        const closed = panel.hidden || (panel.tagName === "DETAILS" && !panel.open) || panel.id === "mainNav";
        assert.ok(closed, "panel " + panel.id + " is hidden while its button says false");
      } else {
        assert.ok(!panel.hidden, "panel " + panel.id + " is shown while its button says true");
      }
    }
    for (const d of document.querySelectorAll("details:not([open])")) {
      assert.equal(d.querySelectorAll("[tabindex]:not([tabindex='-1']):not([tabindex='0'])").length, 0, "no positive tabindex inside a closed details");
    }
  });
}
