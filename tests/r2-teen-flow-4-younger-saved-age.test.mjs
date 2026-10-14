// Ticket r2-teen-flow-4: younger.html's "Your next step" button and the yNext line use the age saved on Programs
// (localStorage "findprefs"), when it is 12, 13 or 14. Any other value, or no saved age, keeps find.html?age=13.
// Run with: node --test tests/r2-teen-flow-4-younger-saved-age.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

async function hrefsFor(storage) {
  const { document, errors } = await loadPage("younger.html", { storage });
  await tick(120);
  assert.deepEqual(errors, []);
  const btn = document.querySelector("#next-step a.btn").getAttribute("href");
  const next = document.querySelector("#yNext a").getAttribute("href");
  return { btn, next };
}

// 2026-10-14: the saved place (Berkeley) now preselects California, and a picked state carries into Programs as where=
// with the California hubs (tests/younger-state-links.dom.test.mjs), so the age stays 12 and the hubs follow.
test("younger: a saved age of 12 sends the next step button and the yNext link to find.html?age=12", async () => {
  const { btn, next } = await hrefsFor({ findprefs: { age: "12", place: "city:berkeley" } });
  assert.equal(btn, "find.html?age=12&where=davis,sv,oak,sf,state,socal,cv");
  assert.equal(next, "find.html?age=12&where=davis,sv,oak,sf,state,socal,cv");
});

test("younger: a saved age of 14 sends the next step button and the yNext link to find.html?age=14", async () => {
  const { btn, next } = await hrefsFor({ findprefs: { age: "14" } });
  assert.equal(btn, "find.html?age=14");
  assert.equal(next, "find.html?age=14");
});

test("younger: a saved age of 13 keeps find.html?age=13", async () => {
  const { btn, next } = await hrefsFor({ findprefs: { age: "13" } });
  assert.equal(btn, "find.html?age=13");
  assert.equal(next, "find.html?age=13");
});

test("younger: with no saved preference both links stay find.html?age=13", async () => {
  const { btn, next } = await hrefsFor({});
  assert.equal(btn, "find.html?age=13");
  assert.equal(next, "find.html?age=13");
});

test("younger: an invalid saved age such as 99 keeps find.html?age=13", async () => {
  const { btn, next } = await hrefsFor({ findprefs: { age: "99" } });
  assert.equal(btn, "find.html?age=13");
  assert.equal(next, "find.html?age=13");
});

test("younger: a saved age that is not a string (number 12) keeps find.html?age=13", async () => {
  const { btn, next } = await hrefsFor({ findprefs: { age: 12 } });
  assert.equal(btn, "find.html?age=13");
  assert.equal(next, "find.html?age=13");
});
