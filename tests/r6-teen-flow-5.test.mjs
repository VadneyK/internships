// Ticket r2-teen-flow-5 (calendar side): the empty-month "anytime" link keeps the teen's age and area.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ANYTIME = "find.html?when=anytime";

test("calendar empty-month link: with no age and no place it is exactly find.html?when=anytime", async () => {
  const p = await loadPage("calendar.html", { search: "?m=7", storage: {} }); await tick(200);
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.getElementById("cNoneAnytime").getAttribute("href"), ANYTIME);
  assert.equal(p.document.getElementById("cNone").querySelector("a").textContent, "programs you can apply to anytime");
});

test("calendar empty-month link: age 14 and a place are carried as when, age, at in that order", async () => {
  const p = await loadPage("calendar.html", { search: "?m=7&age=14&at=area:midwest", storage: {} }); await tick(200);
  const href = p.document.getElementById("cNoneAnytime").getAttribute("href");
  assert.equal(href, "find.html?when=anytime&age=14&at=area%3Amidwest");
  const sp = new URL(href, "https://example.test/").searchParams;
  assert.equal(sp.get("when"), "anytime");
  assert.equal(sp.get("age"), "14");
  assert.equal(sp.get("at"), "area:midwest");
});

test("calendar empty-month link: follows age, place and month changes", async () => {
  const p = await loadPage("calendar.html", { search: "?m=7", storage: {} }); await tick(200);
  const { window, document } = p;
  const link = () => document.getElementById("cNoneAnytime").getAttribute("href");
  type(window, document.getElementById("cAge"), "14");
  assert.equal(link(), "find.html?when=anytime&age=14");
  type(window, document.getElementById("cPlace"), "area:midwest");
  assert.equal(link(), "find.html?when=anytime&age=14&at=area%3Amidwest");
  type(window, document.getElementById("cAge"), "");
  assert.equal(link(), "find.html?when=anytime&at=area%3Amidwest");
  document.querySelector('#months .chip[data-m="8"]').click();
  assert.equal(link(), "find.html?when=anytime&at=area%3Amidwest");
  type(window, document.getElementById("cPlace"), "");
  assert.equal(link(), ANYTIME);
  assert.equal(document.getElementById("cNone").querySelector("a").textContent, "programs you can apply to anytime");
});
