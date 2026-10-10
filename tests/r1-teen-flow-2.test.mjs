// Ticket r1-teen-flow-2: the home picker never shows a dead "See all 0 matches" button.
// When nothing matches, #matchMore offers one plain "Browse all programs" link (find.html, no query),
// plus the "Under 14?" link when the age is 12 or 13.
// Run with: node --test tests/r1-teen-flow-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage, type, tick } from "./dom-helper.mjs";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const lite = require("../data/entries-lite.json");

const AGES = ["12", "13", "14", "15", "16", "17", "18"];
const FIELD_KEYS = Object.keys(L.FIELDS).filter((k) => k !== "any");
const PLACES = L.CITIES.map((c) => "city:" + c[0]); // the value fillPlaces writes into #pHub

// Every age, interest and city combination that the picker can make, with zero matches on the lite file.
function zeroCombos() {
  const now = Date.now();
  const out = [];
  for (const age of AGES) for (const field of FIELD_KEYS) for (const place of PLACES) {
    if (!lite.some((e) => L.matches(e, { place, age, fields: [field] }, now))) out.push({ age, field, place });
  }
  return out;
}

// Checks the zero-match state of the picker: one Browse link, no "See all 0", the age link only for 12 and 13.
function assertNoMatchState(document, age) {
  const more = document.getElementById("matchMore");
  assert.equal(more.hidden, false, "#matchMore should show the browse link");
  assert.doesNotMatch(more.textContent, /See all 0/, "no See all 0 button");
  assert.doesNotMatch(more.textContent, /0 matches/, "no 0 matches text");
  assert.doesNotMatch(more.innerHTML, /find\.html\?/, "the browse link has no query string");
  const browse = more.querySelector('a[href="find.html"]');
  assert.ok(browse, "expected a[href=\"find.html\"] in #matchMore");
  assert.equal(browse.textContent.trim(), "Browse all programs");
  const younger = more.querySelector('a[href="younger.html"]');
  if (age === "12" || age === "13") {
    assert.ok(younger, "age " + age + " should also get the younger.html link");
    assert.equal(younger.textContent.trim(), "Under 14? Read the ages 12 to 14 page");
  } else {
    assert.equal(younger, null, "age " + age + " should not get the younger.html link");
  }
  assert.equal(more.querySelectorAll("a").length, younger ? 2 : 1, "one primary link, plus the younger link only when it applies");
  assert.match(document.getElementById("matches").textContent, /No exact match yet/);
}

// A card file with no programs in it, so every pick has zero matches. Patches fetch after loadPage assigns its own.
function emptyCardFile(w) {
  let real;
  Object.defineProperty(w, "fetch", {
    configurable: true,
    get: () => (u, o) => (/entries-card\.json/.test(String(u))
      ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
      : real(u, o)),
    set: (v) => { real = v; },
  });
}

test("home picker: a real zero-match combination shows Browse all programs and no See all 0", async (t) => {
  const zeros = zeroCombos();
  if (!zeros.length) {
    t.diagnostic("no zero-match age, interest and area combination in the data today (ages 12 to 18, every interest, every city); the real-data case is not exercised, the empty-data cases below cover the branch");
    return;
  }
  const combo = zeros.find((z) => z.age === "12") || zeros[0];
  t.diagnostic("zero-match combination used: " + JSON.stringify(combo));
  const { window, document, errors } = await loadPage("index.html");
  type(window, document.getElementById("pAge"), combo.age);
  type(window, document.getElementById("pHub"), combo.place);
  type(window, document.getElementById("pField"), combo.field);
  await tick(100);
  assert.deepEqual(errors, []);
  assertNoMatchState(document, combo.age);
});

test("home picker: a real zero-match combination for age 12 or 13 also shows the younger.html link", async (t) => {
  const zeros = zeroCombos().filter((z) => z.age === "12" || z.age === "13");
  if (!zeros.length) {
    t.diagnostic("no zero-match age 12 or 13 combination in the data today; covered by the empty-data case below");
    return;
  }
  const combo = zeros[0];
  const { window, document, errors } = await loadPage("index.html");
  type(window, document.getElementById("pAge"), combo.age);
  type(window, document.getElementById("pHub"), combo.place);
  type(window, document.getElementById("pField"), combo.field);
  await tick(100);
  assert.deepEqual(errors, []);
  assertNoMatchState(document, combo.age);
});

test("home picker: with no programs at all, age 12 shows the browse link and the younger.html link", async () => {
  const { window, document, errors } = await loadPage("index.html", { setup: emptyCardFile });
  type(window, document.getElementById("pAge"), "12");
  type(window, document.getElementById("pHub"), PLACES[0]);
  type(window, document.getElementById("pField"), FIELD_KEYS[0]);
  await tick(60);
  assert.deepEqual(errors, []);
  assertNoMatchState(document, "12");
  assert.match(document.getElementById("matchStatus").textContent, /No programs match yet/);
});

test("home picker: with no programs at all, age 16 shows only the browse link", async () => {
  const { window, document, errors } = await loadPage("index.html", { setup: emptyCardFile });
  type(window, document.getElementById("pAge"), "16");
  await tick(60);
  assert.deepEqual(errors, []);
  assertNoMatchState(document, "16");
});

test("home picker: with matches, the See all N matches link is unchanged and there is no browse link", async () => {
  const { window, document, errors } = await loadPage("index.html");
  type(window, document.getElementById("pAge"), "16");
  await tick(100);
  assert.deepEqual(errors, []);
  const more = document.getElementById("matchMore");
  const m = more.textContent.match(/See all (\d+) matches/);
  assert.ok(m && Number(m[1]) > 0, "expected See all N matches with N above 0");
  assert.equal(more.querySelector('a[href="find.html"]'), null, "no browse link when there are matches");
  assert.match(document.getElementById("matches").innerHTML, /class="card prog"/);
});
