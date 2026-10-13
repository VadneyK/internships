// Ticket r8-handout-table: a 30 minute phones-only table plan on the handout page.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = new JSDOM(fs.readFileSync(path.join(ROOT, "handout.html"), "utf8")).window.document;
const sec = doc.getElementById("table");

test("the table section exists with its heading, after the 45 minute plan", () => {
  assert.ok(sec);
  assert.equal(sec.querySelector("h2").textContent.trim(), "Run it as a 30 minute table");
  assert.ok(doc.getElementById("teach").compareDocumentPosition(sec) & 4);
  assert.ok(sec.textContent.includes("If you are not a career person"));
  assert.ok(sec.textContent.includes("Confirm first"));
});

test("agenda rows sum to 30 minutes and are contiguous", () => {
  const rows = [...sec.querySelectorAll("tbody tr")].map((r) => r.cells[0].textContent.trim().match(/^(\d+) to (\d+)$/));
  assert.ok(rows.length >= 4 && rows.every(Boolean));
  let at = 0;
  for (const m of rows) { assert.equal(+m[1], at); at = +m[2]; }
  assert.equal(at, 30);
});

test("links to younger.html, mentions grades 7 and 8, no projector, no photos", () => {
  assert.ok(sec.querySelector('a[href="younger.html"]'));
  assert.ok(/grades 7 and 8/i.test(sec.textContent));
  assert.ok(!/projector/i.test(sec.textContent));
  assert.ok(/do not take photos/i.test(sec.textContent));
  assert.ok(!/[\u2013\u2014]/.test(sec.textContent));
});

test("the table is scroll-safe: wrapped in a labelled .tablewrap region", () => {
  const table = sec.querySelector("table");
  assert.ok(table);
  const wrap = table.parentElement;
  assert.ok(wrap.classList.contains("tablewrap"));
  assert.equal(wrap.getAttribute("role"), "region");
  assert.ok((wrap.getAttribute("aria-label") || "").trim().length > 0);
  assert.equal(wrap.getAttribute("tabindex"), "0");
});

test("the section prints: not inside or marked as a print-hidden part", () => {
  for (let el = sec; el && el !== doc.documentElement; el = el.parentElement) {
    assert.ok(!el.classList.contains("noprint"), "ancestor or self has noprint");
    assert.ok(!el.hasAttribute("hidden"), "ancestor or self is hidden");
    assert.ok(!/display\s*:\s*none/i.test(el.getAttribute("style") || ""));
  }
  assert.ok(!sec.closest("header, nav, footer, .top, .foot"));
  assert.ok(sec.closest("main"));
  assert.ok(!sec.querySelector(".noprint .tablewrap, .noprint table"));
  assert.ok(!/projector/i.test(doc.body.textContent.slice(doc.body.textContent.indexOf("Run it as a 30 minute table"))));
});
