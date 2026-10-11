// Ticket r3-teen-flow-21: the permit "Too young" link carries the picked age (12 or 13) to younger.html,
// and younger.html reads ?age= first for its Next links (exactly 12, 13 or 14), then the saved Programs age, then 13.
// Run with: node --test tests/r3-teen-flow-21-younger-age-param.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

async function permitYoungHref(search) {
  const { document, errors } = await loadPage("permit.html", { search });
  await tick(150);
  assert.deepEqual(errors, []);
  const a = document.querySelector('#pOut a[href^="younger.html"]');
  assert.ok(a, "a younger.html link is shown for " + search);
  return a.getAttribute("href");
}

async function youngerHrefs(search, storage = {}) {
  const { document, errors } = await loadPage("younger.html", { search, storage });
  await tick(120);
  assert.deepEqual(errors, []);
  return {
    btn: document.querySelector("#next-step a.btn").getAttribute("href"),
    next: document.querySelector("#yNext a").getAttribute("href"),
  };
}

test("permit: a 12 year old in ca gets the younger link with the state and age=12", async () => {
  assert.equal(await permitYoungHref("?state=ca&age=12&kind=job"), "younger.html?state=ca&age=12");
});

test("permit: a 13 year old in a state outside ca, ga, ny, il still gets age=13 but no state", async () => {
  const href = await permitYoungHref("?state=tx&age=13&kind=job");
  assert.equal(href, "younger.html?age=13");
});

test("younger: ?age=12 sets the next step button and the yNext link to find.html?age=12", async () => {
  const { btn, next } = await youngerHrefs("?age=12");
  assert.equal(btn, "find.html?age=12");
  assert.equal(next, "find.html?age=12");
});

test("younger: ?age=14 with a saved findprefs age 12 uses the address age 14", async () => {
  const { btn, next } = await youngerHrefs("?age=14", { findprefs: { age: "12" } });
  assert.equal(btn, "find.html?age=14");
  assert.equal(next, "find.html?age=14");
});

test("younger: ?age=99 keeps find.html?age=13", async () => {
  const { btn, next } = await youngerHrefs("?age=99");
  assert.equal(btn, "find.html?age=13");
  assert.equal(next, "find.html?age=13");
});

test("younger: a hostile ?age=12<script> value is ignored and keeps find.html?age=13", async () => {
  const { btn, next } = await youngerHrefs("?age=" + encodeURIComponent("12<script>"));
  assert.equal(btn, "find.html?age=13");
  assert.equal(next, "find.html?age=13");
});

test("younger: ?age=abc keeps find.html?age=13", async () => {
  const { btn, next } = await youngerHrefs("?age=abc");
  assert.equal(btn, "find.html?age=13");
  assert.equal(next, "find.html?age=13");
});

test("younger: with no address age, a saved findprefs age 14 still gives find.html?age=14", async () => {
  const { btn, next } = await youngerHrefs("", { findprefs: { age: "14" } });
  assert.equal(btn, "find.html?age=14");
  assert.equal(next, "find.html?age=14");
});
