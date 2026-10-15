// 2026-10-14: a sweep of every page at 390 px found five tables that scrolled sideways inside their box, all because of
// the desktop floor table { min-width: 34rem }. On phones the floor is gone; 2 and 3 column tables fit, and the one
// 5 column table (rules.html, Hours by age) stacks with .stackt like the parents permit table.
// Run with: node --test tests/phone-tables.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("the phone block drops the 34rem floor for every table", () => {
  const css = read("assets/css/style.css");
  assert.match(css, /table \{ border-collapse: collapse; width: 100%; min-width: 34rem;/);
  assert.match(css, /@media \(max-width: 40rem\) \{\n  \/\*[^]*?\*\/\n  table, table\.stackt \{ min-width: 0; \}/);
});

test("rules.html Hours by age stacks: roles, and one label per cell that matches its column", () => {
  for (const f of ["rules.html", "src/rules.html"]) {
    const d = new JSDOM(read(f)).window.document;
    const t = d.querySelector('[aria-label="Hours by age"] table');
    assert.ok(t.classList.contains("stackt"), f);
    assert.equal(t.getAttribute("role"), "table");
    const heads = [...t.querySelectorAll("thead th")].map((h) => h.textContent.trim());
    assert.equal(heads.length, 5);
    for (const tr of t.querySelectorAll("tbody tr")) {
      assert.equal(tr.getAttribute("role"), "row");
      assert.equal(tr.querySelector("th").getAttribute("role"), "rowheader");
      [...tr.querySelectorAll("td")].forEach((td, i) => {
        assert.equal(td.getAttribute("role"), "cell");
        const k = td.firstElementChild;
        assert.ok(k && k.classList.contains("tk"), f + " cell label");
        assert.equal(k.textContent, heads[i + 1]);
        assert.equal(k.getAttribute("aria-hidden"), "true");
      });
    }
  }
});

test("every table with five or more columns on a built page stacks on phones", () => {
  const pages = fs.readdirSync(new URL("../", import.meta.url)).filter((f) => f.endsWith(".html"));
  for (const f of pages) {
    const d = new JSDOM(read(f)).window.document;
    for (const t of d.querySelectorAll("table")) {
      const cols = t.querySelectorAll("thead th").length;
      if (cols >= 5) assert.ok(t.classList.contains("stackt"), f + ": a " + cols + " column table must use .stackt");
    }
  }
});

// 2026-10-15: the younger.html grid (job plus the four full states) is drawn by younger.js, so the static check above
// cannot see it. With all four states it is five columns and cut New York and Illinois off on a phone; it now stacks.
test("younger.html grid stacks: every cell starts with its state name, roles are set", async () => {
  const { loadPage, tick } = await import("./dom-helper.mjs");
  const { document } = await loadPage("younger.html");
  for (let i = 0; i < 120 && !document.querySelector("#gridT tbody tr"); i++) await tick(25);
  const t = document.getElementById("gridT");
  assert.ok(t.classList.contains("stackt"));
  assert.equal(t.getAttribute("role"), "table");
  const heads = [...t.querySelectorAll("thead th")].map((h) => h.textContent);
  assert.equal(heads.length, 5);
  for (const tr of t.querySelectorAll("tbody tr")) {
    assert.equal(tr.getAttribute("role"), "row");
    [...tr.querySelectorAll("td")].forEach((td, i) => {
      assert.equal(td.getAttribute("role"), "cell");
      assert.equal(td.firstElementChild.className, "tk");
      assert.equal(td.firstElementChild.textContent, heads[i + 1]);
    });
  }
});
