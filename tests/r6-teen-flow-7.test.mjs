// Ticket r2-teen-flow-7 (test, size M): pages that take state and age in the address
// all accept the same good values and ignore bad ones.
// Run with: node --test tests/r6-teen-flow-7.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const PAGES = ["permit.html", "interview.html", "younger.html", "paycheck.html", "calendar.html", "find.html"];

// Every select value, plus which month chips are pressed, as one comparable snapshot.
function snapshot(document) {
  const snap = {};
  for (const s of document.querySelectorAll("main select")) snap[s.id] = s.value;
  snap.months = [...document.querySelectorAll("#months [aria-pressed='true']")].map((b) => b.dataset.m).join(",");
  return snap;
}

function badText(document) {
  const text = document.body.textContent;
  return (/\bundefined\b/.test(text) ? ["undefined"] : []).concat(/\bNaN\b/.test(text) ? ["NaN"] : []);
}

function findprefs(window) {
  try { return window.localStorage.getItem("findprefs"); } catch (e) { return null; }
}

// Good values: the page, the address, and the selects that must match.
const GOOD = [
  ["permit.html", "?state=ca&age=15&kind=job", { pState: "ca", pAge: "15", pKind: "job" }],
  ["interview.html", "?state=ny&age=16", { aState: "ny", aAge: "16" }],
  ["younger.html", "?state=il", { yState: "il" }],
  ["paycheck.html", "?state=ga", { mState: "ga" }],
  ["calendar.html", "?m=3&age=14", { cAge: "14", __month: "3" }],
  ["find.html", "?age=15", { age: "15" }],
];

for (const [page, search, want] of GOOD) {
  test(`r6-teen-flow-7: ${page}${search} selects the matching options`, async () => {
    const { window, document, errors } = await loadPage(page, { search });
    const snap = snapshot(document);
    for (const [id, value] of Object.entries(want)) {
      if (id === "__month") assert.equal(snap.months, value, `${page}: month chip`);
      else assert.equal(snap[id], value, `${page}${search}: #${id}`);
    }
    assert.deepEqual(errors, [], `${page}: console errors`);
    assert.deepEqual(badText(document), [], `${page}: undefined or NaN text`);
    assert.equal(findprefs(window), null, `${page}: wrote findprefs`);
  });
}

// Bad values, tried on every page.
const BAD = [
  "?state=XX",
  "?state=zz&age=99",
  "?age=99",
  "?age=abc",
  "?age=",
  "?state=",
  "?",
  "?m=13",
  "?m=0",
  "?m=abc",
  "?at=nowhere",
  "?age[]=1",
  "?state[]=ca&age[]=15",
  "?state=xx&state=ca&age=abc&age=15",
  "?kind=nonsense",
];

for (const page of PAGES) {
  test(`r6-teen-flow-7: ${page} ignores bad address values`, async () => {
    const base = await loadPage(page);
    const want = snapshot(base.document);
    base.window.close();
    for (const search of BAD) {
      const { window, document, errors } = await loadPage(page, { search });
      const got = snapshot(document);
      // Calendar only: a good month may legitimately differ from the default, but none of these are good.
      assert.deepEqual(got, want, `${page}${search}: selects should stay at their defaults`);
      assert.deepEqual(errors, [], `${page}${search}: console errors`);
      assert.deepEqual(badText(document), [], `${page}${search}: undefined or NaN text`);
      assert.equal(findprefs(window), null, `${page}${search}: wrote findprefs`);
      window.close();
    }
  });
}
