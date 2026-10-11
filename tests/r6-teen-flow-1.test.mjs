// Ticket r2-teen-flow-1: Permit and Plan-your-hours start from the age saved by Programs (findprefs), read only.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const PREFS = { age: "15", place: "city:berkeley" };
const val = (d, id) => d.getElementById(id).value;

test("permit starts from the saved age and the state of the saved area, and leaves kind empty", async () => {
  const { document, window, errors } = await loadPage("permit.html", { storage: { findprefs: PREFS } });
  await tick(300);
  assert.equal(val(document, "pAge"), "15");
  assert.equal(val(document, "pState"), "ca"); // city:berkeley is in California (r3-teen-flow-2)
  assert.equal(val(document, "pKind"), "");
  assert.equal(window.localStorage.getItem("findprefs"), JSON.stringify(PREFS));
  assert.deepEqual(errors, []);
});

test("permit address age wins over the saved age", async () => {
  const { document } = await loadPage("permit.html", { search: "?age=17", storage: { findprefs: PREFS } });
  await tick(300);
  assert.equal(val(document, "pAge"), "17");
});

test("permit ignores a bad saved age", async () => {
  for (const age of ["9", "abc", 15]) {
    const { document } = await loadPage("permit.html", { storage: { findprefs: { age } } });
    await tick(300);
    assert.equal(val(document, "pAge"), "");
  }
});

test("interview starts from the saved age", async () => {
  const { document, window, errors } = await loadPage("interview.html", { storage: { findprefs: PREFS } });
  await tick(300);
  assert.equal(val(document, "aAge"), "15");
  assert.equal(val(document, "aState"), "ca"); // city:berkeley is in California (r3-teen-flow-2)
  assert.equal(window.localStorage.getItem("findprefs"), JSON.stringify(PREFS));
  assert.deepEqual(errors, []);
});

test("interview address and its own saved plan win over findprefs", async () => {
  let r = await loadPage("interview.html", { search: "?state=ca&age=16", storage: { findprefs: PREFS } });
  await tick(300);
  assert.equal(val(r.document, "aAge"), "16");
  assert.equal(val(r.document, "aState"), "ca");
  r = await loadPage("interview.html", { storage: { findprefs: PREFS, interview: { q: {}, refs: [], av: { age: "17" } } } });
  await tick(300);
  assert.equal(val(r.document, "aAge"), "17");
});

test("interview ignores a bad saved age, including 18", async () => {
  for (const age of ["9", "abc", "18"]) {
    const { document } = await loadPage("interview.html", { storage: { findprefs: { age } } });
    await tick(300);
    assert.equal(val(document, "aAge"), "");
  }
});
