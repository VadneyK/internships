import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && fs.readFileSync(path.join(ROOT, f), "utf8").includes("<table"));

function nameOf(doc, t) {
  const cap = t.querySelector(":scope > caption");
  if (cap && cap.textContent.trim()) return cap.textContent.trim();
  const al = (t.getAttribute("aria-label") || "").trim();
  if (al) return al;
  const ids = (t.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
  return ids.map((i) => (doc.getElementById(i) ? doc.getElementById(i).textContent.trim() : "")).join(" ").trim();
}

function check(f, doc) {
  const tables = [...doc.querySelectorAll("main table")].filter((t) => !t.closest("#printRoot"));
  const names = tables.map((t) => nameOf(doc, t));
  names.forEach((n, i) => assert.ok(n, f + ": table " + i + " has no accessible name"));
  assert.equal(new Set(names).size, names.length, f + ": table names repeat: " + names.join(" | "));
  return tables.length;
}

test("every table in main has its own accessible name", async () => {
  assert.ok(pages.length >= 7);
  let total = 0;
  for (const f of pages) {
    const { document } = await loadPage(f);
    total += check(f, document);
  }
  assert.ok(total >= 10, "found " + total + " tables");
});

test("the paycheck estimate table is named after a calculation", async () => {
  const { window, document } = await loadPage("paycheck.html"); await tick(200);
  type(window, document.getElementById("mWage"), "15");
  const h = document.getElementById("mHours");
  type(window, h, "10");
  await tick(200);
  const t = document.querySelector("#mOut table");
  assert.ok(t, "estimate table shows");
  assert.equal(check("paycheck.html", document), 1);
});
