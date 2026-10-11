// Browser bar color: every root page has two media-scoped theme-color metas (light and dark --paper from style.css),
// and the in-page theme button moves the bar color with a forced theme.
// Run with: node --test tests/r2-a11y-perf-17.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// Light --paper is the first declaration in the file (the :root block). Dark --paper is the one in the
// system dark media block, which comes after that block.
const LIGHT = /--paper:\s*(#[0-9a-fA-F]{6})\s*;/.exec(CSS)[1];
const darkStart = CSS.indexOf("@media (prefers-color-scheme: dark)");
const DARK = /--paper:\s*(#[0-9a-fA-F]{6})\s*;/.exec(CSS.slice(darkStart))[1];

test("style.css: light and dark --paper values were found", () => {
  assert.match(LIGHT, /^#/);
  assert.match(DARK, /^#/);
  assert.notEqual(LIGHT.toLowerCase(), DARK.toLowerCase());
});

for (const page of PAGES) {
  test(`${page}: exactly two theme-color metas, one per color scheme, with the --paper values`, () => {
    const html = fs.readFileSync(path.join(ROOT, page), "utf8");
    const dom = new JSDOM(html);
    const metas = [...dom.window.document.querySelectorAll('meta[name="theme-color"]')];
    dom.window.close();
    assert.equal(metas.length, 2, `${page} has ${metas.length} theme-color metas`);
    const light = metas.filter((m) => m.getAttribute("media") === "(prefers-color-scheme: light)");
    const dark = metas.filter((m) => m.getAttribute("media") === "(prefers-color-scheme: dark)");
    assert.equal(light.length, 1, `${page} needs one light theme-color meta`);
    assert.equal(dark.length, 1, `${page} needs one dark theme-color meta`);
    assert.equal(light[0].getAttribute("content").toLowerCase(), LIGHT.toLowerCase());
    assert.equal(dark[0].getAttribute("content").toLowerCase(), DARK.toLowerCase());
  });
}

test("index.html: the theme button forces dark then light, the bar color follows, and no console error", async () => {
  const problems = [];
  const { window, document, errors } = await loadPage("index.html", {
    setup(w) {
      for (const level of ["error", "warn"]) {
        const orig = w.console[level] && w.console[level].bind(w.console);
        w.console[level] = (...a) => { problems.push(`console.${level}: ` + a.map(String).join(" ")); if (orig) orig(...a); };
      }
      w.addEventListener("error", (e) => problems.push("window error: " + (e.message || e.type)));
    },
  });
  try {
    await tick(100);
    const btn = document.getElementById("themeBtn");
    assert.ok(btn, "missing #themeBtn");
    const colors = () => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute("content").toLowerCase());

    btn.click();
    assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
    assert.deepEqual(colors(), [DARK.toLowerCase(), DARK.toLowerCase()], "dark forced: bar color should match dark --paper");

    btn.click();
    assert.equal(document.documentElement.getAttribute("data-theme"), "light");
    assert.deepEqual(colors(), [LIGHT.toLowerCase(), LIGHT.toLowerCase()], "light forced: bar color should match light --paper");

    assert.deepEqual(problems, [], "console or window errors on the theme toggle");
    assert.deepEqual(errors.filter((e) => !/Not implemented/.test(e)), [], "jsdom errors on the theme toggle");
  } finally {
    window.close();
  }
});
