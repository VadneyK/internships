// Ticket r3-teen-flow-6: each month chip on calendar.html shows how many programs that month has.
// The count follows the current Where and Age, and it matches the cards shown after the chip is clicked.
// Run with: node --test tests/r3-teen-flow-6.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const cardCount = (document) => document.querySelectorAll("#cClose li, #cOpen li").length;

function chipState(document) {
  return [...document.querySelectorAll("#months .chip")].map((b) => ({
    m: b.getAttribute("data-m"),
    label: b.getAttribute("aria-label"),
    count: b.querySelector(".n") ? b.querySelector(".n").textContent : null,
    text: b.textContent,
  }));
}

// Click each chip and check its count against the cards that show after the click.
function assertCountsMatchCards(page, where) {
  const { document } = page;
  for (const b of [...document.querySelectorAll("#months .chip")]) {
    b.click();
    const shown = cardCount(document);
    const chip = document.querySelector(`#months .chip[data-m="${b.getAttribute("data-m")}"]`);
    const n = chip.querySelector(".n");
    assert.ok(n, `${where}: month ${chip.getAttribute("data-m")} chip has a count`);
    assert.equal(n.textContent, String(shown), `${where}: month ${chip.getAttribute("data-m")} count matches the cards shown`);
  }
}

test("r3-teen-flow-6: every month chip has a count span, a readable aria-label, and keeps data-m", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" }); await tick(200);
  const { document } = p;
  assert.deepEqual(p.errors, []);
  const chips = chipState(document);
  assert.equal(chips.length, 12);
  chips.forEach((c, i) => {
    assert.equal(c.m, String(i + 1), "data-m is kept in order");
    assert.match(c.count, /^\d+$/, `chip ${c.m} shows a whole number`);
    assert.match(c.text, new RegExp("^" + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i]), `chip ${c.m} starts with its short month name`);
    const n = Number(c.count);
    assert.match(c.label, /^[A-Z][a-z]+, \d+ programs?$/, `chip ${c.m} aria-label`);
    assert.equal(c.label.endsWith(n === 1 ? " 1 program" : ` ${n} programs`), true, `chip ${c.m} aria-label count matches`);
  });
  assert.equal(chips[1].label.startsWith("February, "), true, "February label uses the full month name");
});

test("r3-teen-flow-6: each chip count equals the cards shown after clicking it", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" }); await tick(200);
  assertCountsMatchCards(p, "any place, any age");
  assert.deepEqual(p.errors, []);
});

test("r3-teen-flow-6: counts follow Where and Age, and stay equal to the cards", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" }); await tick(200);
  const { window, document } = p;
  const before = chipState(document);
  const febBefore = Number(before[1].count);

  type(window, document.getElementById("cAge"), "13");
  const afterAge = chipState(document);
  assert.notEqual(afterAge[1].count, before[1].count, "February count changes when Age changes");
  assert.ok(Number(afterAge[1].count) < febBefore, "a 13 year old sees fewer February programs");
  assertCountsMatchCards(p, "age 13");

  type(window, document.getElementById("cPlace"), "area:midwest");
  assertCountsMatchCards(p, "age 13, midwest");

  type(window, document.getElementById("cAge"), "");
  type(window, document.getElementById("cPlace"), "");
  assert.equal(chipState(document)[1].count, before[1].count, "clearing both filters restores the first counts");
  assertCountsMatchCards(p, "cleared filters");
});

test("r3-teen-flow-6: the page shows no undefined or NaN in chips, labels or text", async () => {
  for (const search of ["?m=2", "?m=7&at=city:san-diego", "?m=12&age=15"]) {
    const p = await loadPage("calendar.html", { search }); await tick(200);
    const { document } = p;
    assert.deepEqual(p.errors, [], search);
    for (const b of document.querySelectorAll("#months .chip")) {
      assert.doesNotMatch(b.textContent, /undefined|NaN/, search);
      assert.doesNotMatch(b.getAttribute("aria-label") || "", /undefined|NaN/, search);
    }
    assert.doesNotMatch(document.body.textContent, /undefined|NaN/, search);
  }
});
