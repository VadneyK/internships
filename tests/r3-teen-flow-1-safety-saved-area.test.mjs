// Ticket r3-teen-flow-1: safety.html starts on the state saved on Programs (localStorage "findprefs", place).
// A ?state= in the address wins. An invalid, uncovered or non-object saved value leaves the picker empty with every number shown.
// Read only: nothing is written to storage. Run with: node --test tests/r3-teen-flow-1-safety-saved-area.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

async function open(opts) {
  const p = await loadPage("safety.html", opts);
  await tick(250);
  return p;
}
function shownGroups(document) {
  return [...document.querySelectorAll("#sbody-call .hgroup")].filter((g) => !g.hidden).map((g) => g.getAttribute("data-group"));
}
function nextHrefs(document) {
  return [...document.querySelectorAll("#sNext a[href]")].map((a) => a.getAttribute("href"));
}

test("saved Programs area (Georgia, New York, Illinois, California) preselects that state, shows its numbers, and syncs #sNext", async () => {
  const cases = [
    ["city:atlanta", "ga", "Georgia"],
    ["city:new-york-city", "ny", "New York"],
    ["city:chicago", "il", "Illinois"],
    ["city:berkeley", "ca", "California"],
  ];
  for (const [place, id, name] of cases) {
    const p = await open({ storage: { findprefs: { age: "16", place } } });
    assert.deepEqual(p.errors, [], place);
    const { document, window } = p;
    assert.equal(document.getElementById("sState").value, id, place);
    assert.deepEqual(shownGroups(document).sort(), ["National", name].sort(), place);
    assert.equal(document.getElementById("sOtherNote").hidden, true, place);
    const hrefs = nextHrefs(document);
    assert.ok(hrefs.includes("paycheck.html?state=" + id), place + " " + hrefs);
    assert.ok(hrefs.includes("permit.html?state=" + id), place + " " + hrefs);
    assert.equal(window.localStorage.length, 1, place + ": nothing written");
    assert.deepEqual(JSON.parse(window.localStorage.getItem("findprefs")), { age: "16", place }, place + ": saved value not rewritten");
  }
});

test("a ?state= in the address wins over the saved area", async () => {
  const p = await open({ search: "?state=il", storage: { findprefs: { age: "16", place: "city:berkeley" } } });
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.getElementById("sState").value, "il");
  assert.deepEqual(shownGroups(p.document).sort(), ["Illinois", "National"]);
  assert.ok(nextHrefs(p.document).includes("paycheck.html?state=il"));
});

test("an unknown ?state= in the address still wins: the picker stays empty, not the saved area", async () => {
  const p = await open({ search: "?state=zz", storage: { findprefs: { age: "16", place: "city:berkeley" } } });
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.getElementById("sState").value, "");
  assert.equal(shownGroups(p.document).length, 5);
});

test("an invalid, uncovered or non-object saved value leaves the picker empty with every number shown and no error", async () => {
  const saved = [
    { findprefs: { age: "16", place: "city:seattle" } },
    { findprefs: { age: "16", place: "state:washington" } },
    { findprefs: { age: "16", place: "virtual" } },
    { findprefs: { age: "16", place: "area:nowhere" } },
    { findprefs: { age: "16", place: 42 } },
    { findprefs: "Georgia" },
    { findprefs: ["city:atlanta"] },
    { findprefs: null },
  ];
  for (const storage of saved) {
    const p = await open({ storage });
    assert.deepEqual(p.errors, [], JSON.stringify(storage));
    assert.equal(p.document.getElementById("sState").value, "", JSON.stringify(storage));
    assert.equal(shownGroups(p.document).length, 5, JSON.stringify(storage));
  }
});
