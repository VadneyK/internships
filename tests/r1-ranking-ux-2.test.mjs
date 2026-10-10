// Programs page remembers the last Where and age (ticket r1-ranking-ux-2).
// Run with: node --test tests/r1-ranking-ux-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const TOTAL = DATA.length;
const NOTE = "Using the age and area you picked last time. Press Clear all to start over.";

const shown = (doc) => {
  const m = /^(\d+) of (\d+) programs$/.exec(doc.getElementById("count").textContent);
  assert.ok(m, "unexpected count text: " + doc.getElementById("count").textContent);
  return Number(m[1]);
};
const expected = (s) => DATA.filter((e) => L.matches(e, s, Date.now())).length;

test("(a) stored age and place fill the selects, filter the list and show the note", async () => {
  const { document, window, errors } = await loadPage("find.html", { storage: { findprefs: { age: "15", place: "city:berkeley" } } });
  assert.equal(document.getElementById("age").value, "15");
  assert.equal(document.getElementById("place").value, "city:berkeley");
  const n = shown(document);
  assert.equal(n, expected({ age: "15", place: "city:berkeley" }));
  assert.ok(n > 0 && n < TOTAL, "list should be narrowed (got " + n + " of " + TOTAL + ")");
  const note = document.getElementById("prefNote");
  assert.equal(note.hidden, false);
  assert.equal(note.textContent.trim(), NOTE);
  const p = new window.URLSearchParams(window.location.search);
  assert.equal(p.get("age"), "15");
  assert.equal(p.get("at"), "city:berkeley");
  assert.deepEqual(errors, []);
});

test("the note is hidden by default and when the teen changes a picker", async () => {
  const fresh = await loadPage("find.html");
  assert.equal(fresh.document.getElementById("prefNote").hidden, true);
  const { document, window } = await loadPage("find.html", { storage: { findprefs: { age: "15", place: "city:berkeley" } } });
  type(window, document.getElementById("age"), "16");
  await tick();
  assert.equal(document.getElementById("prefNote").hidden, true);
});

test("(b) any address parameter wins: nothing is filled and the note is hidden", async () => {
  const { document, errors } = await loadPage("find.html", { search: "?q=coding", storage: { findprefs: { age: "15", place: "city:berkeley" } } });
  assert.equal(document.getElementById("age").value, "");
  assert.equal(document.getElementById("place").value, "");
  assert.equal(document.getElementById("prefNote").hidden, true);
  assert.deepEqual(errors, []);
});

test("(c) picking an age and a city is remembered on the next visit", async () => {
  const first = await loadPage("find.html");
  type(first.window, first.document.getElementById("age"), "16");
  type(first.window, first.document.getElementById("place"), "city:davis");
  await tick();
  const saved = first.window.localStorage.getItem("findprefs");
  assert.deepEqual(JSON.parse(saved), { age: "16", place: "city:davis" });
  const second = await loadPage("find.html", { rawStorage: { findprefs: saved } });
  assert.equal(second.document.getElementById("age").value, "16");
  assert.equal(second.document.getElementById("place").value, "city:davis");
  assert.equal(shown(second.document), expected({ age: "16", place: "city:davis" }));
  assert.deepEqual(second.errors, []);
});

test("(d) Clear all removes the saved values and a fresh load is unfiltered", async () => {
  const { document, window } = await loadPage("find.html", { storage: { findprefs: { age: "15", place: "city:berkeley" } } });
  document.getElementById("reset").click();
  await tick();
  const left = window.localStorage.getItem("findprefs");
  assert.ok(!left, "findprefs should be gone, got " + left);
  assert.equal(document.getElementById("prefNote").hidden, true);
  const again = await loadPage("find.html", { rawStorage: left ? { findprefs: left } : {} });
  assert.equal(again.document.getElementById("age").value, "");
  assert.equal(again.document.getElementById("place").value, "");
  assert.equal(shown(again.document), TOTAL);
});

test("(e) damaged or invalid saved values are ignored without errors", async () => {
  for (const raw of ["null", "5", "[1]", "not json", '{"age":"99","place":"city:nowhere"}', '{"age":15,"place":["x"]}']) {
    const { document, errors } = await loadPage("find.html", { rawStorage: { findprefs: raw } });
    assert.equal(document.getElementById("age").value, "", raw);
    assert.equal(document.getElementById("place").value, "", raw);
    assert.equal(document.getElementById("prefNote").hidden, true, raw);
    assert.deepEqual(errors, [], raw);
  }
});

test("a valid age with an invalid place keeps only the age", async () => {
  const { document } = await loadPage("find.html", { rawStorage: { findprefs: '{"age":"13","place":"city:nowhere"}' } });
  assert.equal(document.getElementById("age").value, "13");
  assert.equal(document.getElementById("place").value, "");
});

test("(f) when localStorage.setItem throws, the selects still work with no errors", async () => {
  const { document, window, errors } = await loadPage("find.html", {
    setup(w) { w.Storage.prototype.setItem = function () { throw new Error("quota"); }; },
  });
  type(window, document.getElementById("age"), "17");
  type(window, document.getElementById("place"), "city:davis");
  await tick();
  assert.equal(document.getElementById("age").value, "17");
  assert.equal(shown(document), expected({ age: "17", place: "city:davis" }));
  document.getElementById("reset").click();
  await tick();
  assert.equal(shown(document), TOTAL);
  assert.deepEqual(errors, []);
});
