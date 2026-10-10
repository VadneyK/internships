// Search text is cached per program, and place counts come from one pass.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadPage, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const NOW = new Date(2026, 9, 10, 12).getTime();

// A copy of the search clause of the implementation before the cache, kept here as the reference.
function refQ(e, q) {
  if (!q) return true;
  var hay = [e.name, e.org, e.city, e.what_you_do, e.notes, e.who_can_apply, (e.regions || []).map(L.regionLabel).join(" "), L.TYPES[e.type]].join(" ").toLowerCase();
  var words = q.toLowerCase().split(/\s+/).filter(Boolean);
  var padded = " " + hay.replace(/[^a-z0-9]+/g, " ");
  return words.every(function (w) { return padded.indexOf(" " + w.replace(/[^a-z0-9]+/g, " ")) > -1; });
}
const ids = (list) => list.map((e) => e.id);
const oldIds = (entries, q) => ids(entries.filter((e) => refQ(e, q)));
const newIds = (entries, q) => ids(entries.filter((e) => L.matches(e, { q }, NOW)));

const QUERIES = [
  "summer", "research", "camp", "paid", "unpaid", "stipend", "volunteer", "intern", "stem", "coding",
  "summer research", "paid intern", "unpaid volunteer", "high school", "free program", "art museum", "science camp", "app building", "tech jobs", "teen leadership",
  "co-op", "it's", "a+", "c++", "(paid)", "---", "$$$", "paid, summer", "summer!", "u.s.",
  "SUMMER", "Research", "PAID Intern", "  summer   research  ", "",
  "zzzqqq", "davis", "uc", "nasa", "engineering"
];

test("1: same ids as the old implementation for 40 queries", () => {
  assert.ok(ENTRIES.length > 1000);
  assert.equal(QUERIES.length, 40);
  for (const q of QUERIES) assert.deepEqual(newIds(ENTRIES, q), oldIds(ENTRIES, q), "query: " + JSON.stringify(q));
  // a prefix word must not match inside a longer word
  assert.ok(newIds(ENTRIES, "paid").length > 0);
  // run twice so the second pass reads the cache
  for (const q of QUERIES) assert.deepEqual(newIds(ENTRIES, q), oldIds(ENTRIES, q), "cached, query: " + JSON.stringify(q));
});

test("2: changing notes rebuilds the cached text", () => {
  const e = ENTRIES[0];
  const word = "qzxwvunotesword";
  assert.equal(L.matches(e, { q: word }, NOW), false);
  const saved = e.notes;
  e.notes = (saved ? saved + " " : "") + word;
  try {
    assert.equal(L.matches(e, { q: word }, NOW), true);
    assert.equal(L.matches(e, { q: "zzzzznotthere" }, NOW), false);
  } finally { e.notes = saved; }
  assert.equal(L.matches(e, { q: word }, NOW), false);
  // same for who_can_apply
  const w2 = "qzxwvuwhoword", sw = e.who_can_apply;
  e.who_can_apply = (sw ? sw + " " : "") + w2;
  try { assert.equal(L.matches(e, { q: w2 }, NOW), true); } finally { e.who_can_apply = sw; }
  assert.equal(L.matches(e, { q: w2 }, NOW), false);
});

test("3: filtering with a text query is at least 3 times faster than the old way", () => {
  const q = "summer research";
  const t = (fn) => { const t0 = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t0); };
  const runOld = () => { for (let i = 0; i < 20; i++) ENTRIES.filter((e) => refQ(e, q)); };
  const runNew = () => { for (let i = 0; i < 20; i++) ENTRIES.filter((e) => L.matches(e, { q }, NOW)); };
  runNew(); runOld(); // warm up and fill the cache
  let oldT = Infinity, newT = Infinity;
  for (let r = 0; r < 5; r++) { oldT = Math.min(oldT, t(runOld)); newT = Math.min(newT, t(runNew)); }
  assert.ok(oldT / newT >= 3, "old " + oldT + "ns, new " + newT + "ns, ratio " + (oldT / newT).toFixed(1));
});

test("4: placeCounts equals the old per-place matches loop for all 46 keys", () => {
  const keys = L.CITIES.map((c) => "city:" + c[0]).concat(L.AREAS.map((a) => "area:" + a[0]));
  assert.equal(keys.length, 46);
  const counts = L.placeCounts(ENTRIES);
  assert.deepEqual(Object.keys(counts).sort(), keys.slice().sort());
  for (const k of keys) {
    const old = ENTRIES.filter((e) => L.matches(e, { place: k }, NOW)).length;
    assert.equal(counts[k], old, k);
  }
  assert.deepEqual(L.placeCounts([]), Object.fromEntries(keys.map((k) => [k, 0])));
});

test("5: fillPlaces makes no matches calls and writes the same labels", async () => {
  let calls = 0;
  const { window, document } = await loadPage("calendar.html", {
    now: NOW,
    setup(w) {
      let lib;
      w.TIG = {};
      Object.defineProperty(w.TIG, "lib", {
        configurable: true, enumerable: true, get() { return lib; },
        set(v) { lib = v; const m = v.matches; v.matches = function () { calls++; return m.apply(this, arguments); }; },
      });
    },
  });
  for (let i = 0; i < 100 && !document.querySelector("#cPlace optgroup"); i++) await tick(50);
  await tick(100);
  const sel = document.createElement("select");
  document.body.appendChild(sel);
  calls = 0;
  window.TIG.fillPlaces(sel, ENTRIES);
  assert.equal(calls, 0, "fillPlaces called lib.matches " + calls + " times");
  const got = [...sel.querySelectorAll("option")].map((o) => o.value + "=" + o.textContent);
  const count = (k) => ENTRIES.filter((e) => refPlace(e, k)).length;
  const sorted = L.CITIES.slice().sort((a, b) => (a[1] < b[1] ? -1 : 1));
  const want = [];
  sorted.forEach((x) => want.push("city:" + x[0] + "=" + x[1] + (count("city:" + x[0]) ? " (" + count("city:" + x[0]) + ")" : " (none yet)")));
  L.AREAS.forEach((x) => want.push("area:" + x[0] + "=" + x[1] + (count("area:" + x[0]) ? " (" + count("area:" + x[0]) + ")" : " (none yet)")));
  assert.deepEqual(got, want);
  // an empty list gives "(none yet)" on every option
  const empty = document.createElement("select");
  window.TIG.fillPlaces(empty, []);
  assert.ok([...empty.querySelectorAll("option")].every((o) => /\(none yet\)$/.test(o.textContent)));
  assert.equal(empty.querySelectorAll("option").length, 46);
});

// the old place check, copied from before this change
function refPlace(e, place) {
  var pr = L.placeRegions(place), rs = e.regions || [];
  if (pr && !pr.some(function (r) { return rs.indexOf(r) > -1; })) return false;
  return true;
}
