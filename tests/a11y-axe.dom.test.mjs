// axe-core (the accessibility rules engine) over every built root page in jsdom, before and after opening the phone Menu.
// Tags: WCAG 2.0 A and AA, 2.1 A and AA, 2.2 AA. The color-contrast rule is off because jsdom has no layout; contrast is covered by the token contrast tests.
// Any violation not in KNOWN fails. A KNOWN entry that no longer fires also fails, so the table can only shrink.
// Run with: node --test tests/a11y-axe.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadPage } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const ROOT = new URL("..", import.meta.url).pathname;
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// KNOWN: "page rule-id" -> one-line reason. Recorded, not fixed here. Empty means the pages are clean today.
const KNOWN = {
};

async function scan(window) {
  if (!window.axe) window.eval(axeSource);
  const res = await window.axe.run(window.document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return res.violations;
}

test("axe: the scan really runs (a seeded image with no alt text is caught)", async () => {
  const { window, document } = await loadPage("index.html");
  const img = document.createElement("img");
  img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  document.querySelector("main").appendChild(img);
  const ids = (await scan(window)).map((v) => v.id);
  assert.ok(ids.includes("image-alt"), "axe reports image-alt for the seeded image; got " + ids.join(","));
});

const seen = new Set();
const describe = (v) => v.id + ": " + v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ") + " (" + v.nodes.length + " nodes)";

for (const file of PAGES) {
  test("axe: " + file + " has no unknown WCAG A/AA violations", async () => {
    const { window, document } = await loadPage(file);
    const found = new Map();
    for (const v of await scan(window)) found.set(v.id, v);
    const menu = document.querySelector("button.menu-btn");
    if (menu) {
      menu.click();
      await new Promise((r) => setTimeout(r, 30));
      for (const v of await scan(window)) if (!found.has(v.id)) found.set(v.id, v);
    }
    const unknown = [];
    for (const [id, v] of found) {
      const key = file + " " + id;
      seen.add(key);
      if (!KNOWN[key]) unknown.push(describe(v));
    }
    assert.deepEqual(unknown, [], file + " has axe violations not in KNOWN");
  });
}

test("axe: every KNOWN entry still fires and names a real page", () => {
  for (const key of Object.keys(KNOWN)) {
    const [file] = key.split(" ");
    assert.ok(PAGES.includes(file), key + " names a built page");
    assert.ok(KNOWN[key].length > 10, key + " has a reason");
    assert.ok(seen.has(key), key + " no longer fires; remove it from KNOWN");
  }
});
