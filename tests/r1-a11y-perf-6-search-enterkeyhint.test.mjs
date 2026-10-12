// Phone keyboards: the Programs search box shows a Search key instead of a generic return key.
// Static parse of the built find.html with jsdom: no scripts run, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = new JSDOM(fs.readFileSync(path.join(ROOT, "find.html"), "utf8")).window.document;
const ALLOWED_ENTERKEYHINT = new Set(["search", "done", "go"]);

test("find.html: #q is a search field whose Enter key says Search", () => {
  const el = doc.getElementById("q");
  assert.ok(el, "#q exists");
  assert.equal(el.getAttribute("type"), "search");
  assert.equal(el.getAttribute("enterkeyhint"), "search");
  assert.equal(el.getAttribute("autocomplete"), "off");
});

test("find.html: #q has a label with visible text", () => {
  const label = doc.querySelector('label[for="q"]');
  assert.ok(label, "label[for=q] exists");
  assert.ok(label.textContent.trim().length > 0, "label has text");
  assert.equal(label.closest("[hidden]"), null, "label is not inside a hidden subtree");
  assert.ok(!label.classList.contains("sr"), "label is not screen-reader-only");
});

test("find.html: every enterkeyhint value is search, done or go", () => {
  const bad = [...doc.querySelectorAll("[enterkeyhint]")]
    .filter((el) => !ALLOWED_ENTERKEYHINT.has(el.getAttribute("enterkeyhint")))
    .map((el) => `${el.tagName.toLowerCase()}#${el.id || "?"}="${el.getAttribute("enterkeyhint")}"`);
  assert.deepEqual(bad, []);
});
