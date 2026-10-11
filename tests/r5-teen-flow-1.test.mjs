// Ticket r5-teen-flow-1: Home and Calendar start from the age and area saved by Programs (findprefs), read only.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const PREFS = { age: "15", place: "city:berkeley" };

test("home preselects the saved age and area and draws matches", async () => {
  const { document, window, errors } = await loadPage("index.html", { storage: { findprefs: PREFS } });
  await tick(300);
  assert.equal(document.getElementById("pAge").value, "15");
  assert.equal(document.getElementById("pHub").value, "city:berkeley");
  assert.ok(document.getElementById("matchStatus").textContent.length > 0);
  assert.equal(window.localStorage.getItem("findprefs"), JSON.stringify(PREFS));
  assert.deepEqual(errors, []);
});

test("home ignores bad saved values", async () => {
  for (const raw of ["not json", JSON.stringify({ age: "99", place: "city:nowhere" }), JSON.stringify([1])]) {
    const { document, errors } = await loadPage("index.html", { rawStorage: { findprefs: raw } });
    await tick(150);
    assert.equal(document.getElementById("pAge").value, "");
    assert.equal(document.getElementById("pHub").value, "");
    assert.deepEqual(errors, []);
  }
});

test("calendar preselects saved age and area", async () => {
  const { document, errors } = await loadPage("calendar.html", { storage: { findprefs: PREFS } });
  await tick(200);
  assert.equal(document.getElementById("cAge").value, "15");
  assert.equal(document.getElementById("cPlace").value, "city:berkeley");
  assert.deepEqual(errors, []);
});

test("calendar query params win over saved prefs", async () => {
  const { document, errors } = await loadPage("calendar.html", { search: "?m=3&age=17", storage: { findprefs: PREFS } });
  await tick(200);
  assert.equal(document.getElementById("cAge").value, "17");
  assert.equal(document.getElementById("cPlace").value, "city:berkeley");
  assert.deepEqual(errors, []);
});

test("calendar ignores bad saved values", async () => {
  const { document, errors } = await loadPage("calendar.html", { storage: { findprefs: { age: "40", place: "city:nowhere" } } });
  await tick(200);
  assert.equal(document.getElementById("cAge").value, "");
  assert.equal(document.getElementById("cPlace").value, "");
  assert.deepEqual(errors, []);
});
