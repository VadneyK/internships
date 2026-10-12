// Ticket r3-tests-1: search recall. Every real card must be found by its own name, each name word, its org and its city.
// How matches() treats the query (asserted below, so a change to it is a visible decision):
//  - the query is lower-cased, split on spaces, and every character outside a-z and 0-9 becomes a space
//  - each remaining word must START a word in the card text, so punctuation, "&", hyphens and apostrophes in the query do not matter
//  - a query with no a-z or 0-9 left (only symbols, or only non-ASCII letters) has no words, so it matches every card, same as an empty query
//  - accents are NOT folded: an accented letter counts as a separator, so "cafe" does not find "café" but "café" does
// Run with: node --test tests/r3-tests-1-search-recall.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
globalThis.self = globalThis;
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const NOW = new Date(2026, 9, 10, 12, 0, 0); // fixed: 2026-10-10

const hit = (e, q) => L.matches(e, { q }, NOW);
// Runs one query builder over every card and returns the failing ids in one list.
function failures(build) {
  const bad = [];
  for (const e of ENTRIES) {
    const qs = [].concat(build(e)).filter((q) => q != null);
    for (const q of qs) if (!hit(e, q)) { bad.push(e.id + " <- " + JSON.stringify(q)); break; }
  }
  return bad;
}
// Fixed in lib.js queryNeedles (see the last test below): a query word that STARTS with a symbol, such as "(East", builds the needle "  east" with two spaces and finds nothing.
// So the recall tests below type each word with symbols trimmed from both ends, the way a teen types a name. Symbols inside a word are kept.
const clean = (t) => String(t == null ? "" : t).split(/\s+/).map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "")).filter(Boolean).join(" ");
const nameWords = (e) => String(e.name || "").split(/\s+/).filter((w) => w.replace(/[^a-zA-Z0-9]/g, "").length >= 3);
const noFail = (bad, what) => assert.deepEqual(bad, [], what + " failed for " + bad.length + " card(s): " + bad.slice(0, 40).join(" | "));

test("there are real cards to test", () => { assert.ok(ENTRIES.length > 2000, "cards: " + ENTRIES.length); });

test("every card is found by its full name", () => { noFail(failures((e) => clean(e.name)), "name"); });
test("every card is found by each name word of 3 or more letters", () => {
  noFail(failures((e) => nameWords(e).map(clean)), "name word");
});
test("every card is found by its org", () => { noFail(failures((e) => clean(e.org)), "org"); });
test("every card is found by its city", () => { noFail(failures((e) => clean(e.city)), "city"); });

test("UPPER case, doubled spaces and added punctuation find the same cards", () => {
  noFail(failures((e) => [clean(e.name).toUpperCase(), clean(e.name).split(/\s+/).join("   "), "  " + clean(e.name) + "  ", clean(e.name) + "!", clean(e.org).toUpperCase(), clean(e.city).toUpperCase()]), "case/space/punctuation");
});

test("punctuation, ampersands, apostrophes and hyphens in the query do not matter", () => {
  const boys = ENTRIES.find((e) => /boys\s*(&|and)\s*girls/i.test(e.name + " " + e.org));
  assert.ok(boys, "a Boys & Girls card exists in the data");
  assert.equal(hit(boys, "Boys & Girls"), true);
  assert.equal(hit(boys, "boys girls"), true);
  assert.equal(hit(boys, "boys-girls"), true);
  assert.equal(hit(boys, "BOYS   &   GIRLS"), true);
  // an apostrophe becomes a space on both sides, so "o'neil" is the two words "o" and "neil"
  const o = ENTRIES.find((e) => /\bO'Neil/i.test(e.name + " " + e.org + " " + e.what_you_do));
  if (o) { assert.equal(hit(o, "o'neil"), true); assert.equal(hit(o, "o neil"), true); assert.equal(hit(o, "oneil"), false); }
  // the same holds for any card whose name or org has an apostrophe or hyphen: typing it with a space finds it
  const bad = [];
  for (const e of ENTRIES) for (const f of [e.name, e.org]) {
    if (/['’-]/.test(f || "")) { const alt = f.replace(/['’-]/g, " "); if (!hit(e, clean(f)) || !hit(e, clean(alt))) bad.push(e.id); }
  }
  noFail(bad, "apostrophe or hyphen");
});

test("a query with no a-z or 0-9 matches the same set as an empty query", () => {
  const all = (s) => ENTRIES.filter((e) => L.matches(e, s, NOW)).map((e) => e.id);
  const base = all({ q: "" });
  assert.equal(base.length, ENTRIES.length);
  for (const q of ["&", "!!!", "?!&-'", "   ", "éèñ", "中文", "é ü"]) assert.deepEqual(all({ q }), base, JSON.stringify(q));
  // with another filter on, symbols still change nothing
  assert.deepEqual(all({ q: "!!!", age: "15" }), all({ q: "", age: "15" }));
  assert.ok(all({ q: "", age: "15" }).length < base.length, "the age filter really filters");
});

test("accents are not folded: the accented letter is a separator", () => {
  const fake = { id: "x", name: "Café Crew", org: "Test Org", city: "Austin, TX", regions: [], type: "paid-youth-program" };
  assert.equal(L.matches(fake, { q: "café" }, NOW), true, "typing the accent finds it");
  assert.equal(L.matches(fake, { q: "CAFÉ" }, NOW), true);
  // Behavior: "cafe" does NOT find "Café", because the accented letter becomes a space and " cafe" is not in " caf crew".
  assert.equal(L.matches(fake, { q: "cafe" }, NOW), false);
  assert.equal(L.matches(fake, { q: "caf" }, NOW), true, "the plain start of the word still works");
  // real data: any card with an accented letter in its name is found by typing that name as is
  const acc = ENTRIES.filter((e) => /[^\x00-\x7f]/.test(e.name));
  noFail(acc.filter((e) => !hit(e, e.name)).map((e) => e.id), "accented name typed as is");
});

// lib.js queryNeedles() used to build " " + word with symbols turned into spaces, so a word that starts with a symbol got two leading spaces
// and never matched the single-spaced card text. It now trims the leading spaces before adding the one space.
test("a name typed exactly as printed, with a leading bracket, finds its card", () => {
  noFail(failures((e) => e.name).concat(failures((e) => e.org)).concat(failures((e) => e.city)), "raw name/org/city");
});
