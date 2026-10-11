// Phone menu: focus that leaves the header closes the open menu without moving focus, and a chosen link closes it.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

async function setup() {
  const page = await loadPage("index.html"); await tick(100);
  const { window, document } = page;
  const m = document.querySelector(".menu-btn");
  /* jsdom does not run the phone media query, and it will not focus a display:none button, so show the phone button as a phone would */
  m.style.display = "inline-flex";
  return { window, document, m, top: document.querySelector("header.top"), nav: document.querySelector("header.top .nav") };
}

test("phone menu: Menu button toggles open then closed", async () => {
  const { document, m, top } = await setup();
  m.click();
  assert.ok(top.classList.contains("open"));
  assert.equal(m.getAttribute("aria-expanded"), "true");
  m.click();
  assert.ok(!top.classList.contains("open"));
  assert.equal(m.getAttribute("aria-expanded"), "false");
  assert.ok(document.querySelector("header.top .nav"), "nav still in the page");
});

test("phone menu: focus moving outside the header closes it and does not steal focus", async () => {
  const { window, document, m, top, nav } = await setup();
  m.click();
  const link = nav.querySelector("a");
  link.focus();
  assert.equal(document.activeElement, link);
  const outside = document.querySelector("h1") || document.getElementById("main");
  outside.setAttribute("tabindex", "-1");
  outside.focus();
  outside.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
  assert.ok(!top.classList.contains("open"), "menu closed");
  assert.equal(m.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, outside, "focus stays on the element focused outside");
});

test("phone menu: choosing an in-page hash link closes the menu", async () => {
  const { document, m, top, nav } = await setup();
  let hash = nav.querySelector('a[href^="#"]');
  if (!hash) {
    hash = document.createElement("a");
    hash.setAttribute("href", "#main");
    hash.textContent = "Jump to main";
    nav.appendChild(hash);
  }
  m.click();
  assert.ok(top.classList.contains("open"));
  hash.click();
  assert.ok(!top.classList.contains("open"), "menu closed after the hash link");
  assert.equal(m.getAttribute("aria-expanded"), "false");
});

test("phone menu: Escape closes it and returns focus to the Menu button", async () => {
  const { window, document, m, top } = await setup();
  m.click();
  top.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.ok(!top.classList.contains("open"));
  assert.equal(m.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, m);
});
