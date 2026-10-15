// 2026-10-15: Lighthouse measured a layout shift of 0.17 on every page on phones: the full nav showed first, then
// common.js folded it behind Menu and the page jumped up about 150 px. The head script now marks <html class="js">,
// and the phone CSS hides the nav from the first paint. If no menu is built within 3 seconds (common.js failed),
// the mark is removed so the links show. The menu itself is tested in r1-a11y-perf-7-collapsed-not-tabbable.
// Run with: node --test tests/header-no-shift.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("every built page marks html.js in the head, with the 3 second failsafe", () => {
  const pages = fs.readdirSync(new URL("../", import.meta.url)).filter((f) => f.endsWith(".html"));
  assert.ok(pages.length > 15);
  for (const f of pages) {
    const head = read(f).split("</head>")[0];
    assert.match(head, /document\.documentElement\.classList\.add\("js"\);/, f);
    assert.match(head, /setTimeout\(function \(\) \{ if \(!document\.querySelector\("\.top\.menu-js"\)\) document\.documentElement\.classList\.remove\("js"\); \}, 3000\);/, f);
  }
});

test("the phone block hides the nav under html.js unless the menu is open", () => {
  const css = read("assets/css/style.css");
  const at = css.indexOf(".menu-btn { display: none; }\n@media (max-width: 40rem) {");
  assert.ok(at > -1);
  const block = css.slice(at, css.indexOf("\n}", at));
  assert.match(block, /\n  html\.js \.top:not\(\.open\) \.nav \{ display: none; \}/);
  assert.match(block, /\.top\.menu-js\.open \.nav \{ display: flex; \}/);
});

test("a page loads with html.js set and the Menu button built", async () => {
  const { document } = await loadPage("index.html");
  await tick(100);
  assert.ok(document.documentElement.classList.contains("js"));
  assert.ok(document.querySelector(".top.menu-js button.menu-btn"));
});

test("the failsafe removes html.js when no menu was built", async () => {
  const { document, window } = await loadPage("404.html", { setup: (w) => { w.__noMenu = true; } });
  document.querySelector(".top").classList.remove("menu-js");
  document.documentElement.classList.add("js");
  // Re-run the head script's failsafe line as written in the page, with a short clock.
  const line = read("404.html").match(/setTimeout\(function \(\) \{[^\n]*\}, 3000\);/)[0].replace("3000", "10");
  window.eval(line);
  await tick(60);
  assert.equal(document.documentElement.classList.contains("js"), false);
});
