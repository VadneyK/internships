// p6-younger-1: Ages 12 to 14 page. The four full states are named above the picker. Any other state gets a short card
// from data/states-lite.json (permit, hours, phone as tel:, official page), below the generic "Any other state" card.
// The picker lists every state in data/states-lite.json. states-lite.json is fetched only after a teen picks one of those states.
// Run with: node --test tests/p6-younger-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lite = JSON.parse(fs.readFileSync(path.join(ROOT, "data/states-lite.json"), "utf8"));
const younger = JSON.parse(fs.readFileSync(path.join(ROOT, "data/younger.json"), "utf8"));
const NS = "Not stated on the page we read.";
const FOUR = younger.states.map((s) => s[0]);
const digits = (p) => p.replace(/\D/g, "");
const pick = (window, document, v) => {
  const s = document.getElementById("yState");
  s.value = v;
  s.dispatchEvent(new window.Event("change", { bubbles: true }));
};
const liteById = (id) => lite.states.find((s) => s.id === id);

test("p6-younger-1: the four full states are named by name, above the state picker", async () => {
  const { document, errors } = await loadPage("younger.html"); await tick(120);
  assert.deepEqual(errors, []);
  const note = document.getElementById("fourStates");
  assert.ok(note, "the four-state note exists");
  assert.match(note.textContent, /California, Georgia, New York and Illinois/);
  const sel = document.getElementById("yState");
  assert.ok(document.getElementById("grid").contains(note), "the note is in #grid");
  assert.ok(note.compareDocumentPosition(sel) & 4, "the note comes before the state picker");
});

test("p6-younger-1: the picker lists the four full states first, then every state in states-lite.json, with no repeats", async () => {
  const { document } = await loadPage("younger.html"); await tick(120);
  const opts = [...document.getElementById("yState").options];
  assert.equal(opts[0].value, "", "first option is All four states");
  assert.equal(opts[0].textContent, "All four states");
  assert.deepEqual(opts.slice(1, 1 + FOUR.length).map((o) => o.value), FOUR);
  const rest = opts.slice(1 + FOUR.length);
  assert.equal(rest.length, lite.states.length, "one option per state in states-lite.json");
  assert.deepEqual(new Set(rest.map((o) => o.value)), new Set(lite.states.map((s) => s.id)));
  for (const o of rest) assert.equal(o.textContent, liteById(o.value).name, `label for ${o.value}`);
  const values = opts.map((o) => o.value);
  assert.equal(new Set(values).size, values.length, "no option value is repeated");
  for (const st of younger.states) assert.equal(st[1], opts.find((o) => o.value === st[0]).textContent, `name for ${st[0]}`);
});

test("p6-younger-1: the four-state grid is unchanged: five columns on load, one state plus the job column after a pick", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(120);
  assert.equal(document.querySelectorAll("#gridT thead th").length, 5);
  pick(window, document, "ca");
  assert.equal(document.querySelectorAll("#gridT thead th").length, 2);
  assert.match(document.getElementById("gridT").textContent, /California/);
});

test("p6-younger-1: a state from states-lite.json keeps the four-state grid and shows its short card below the generic card", async () => {
  const { document, window, errors } = await loadPage("younger.html"); await tick(120);
  pick(window, document, "ut"); await tick(200);
  assert.deepEqual(errors, []);
  assert.equal(document.querySelectorAll("#gridT thead th").length, 5, "the table keeps all four full states");
  const generic = document.getElementById("otherState");
  const box = document.getElementById("otherLite");
  assert.equal(generic.hidden, false, "the generic card is still shown");
  assert.equal(box.hidden, false, "the short card is shown");
  assert.ok(generic.compareDocumentPosition(box) & 4, "the short card comes after the generic card");
  const ut = liteById("ut");
  assert.match(box.textContent, /Utah/);
  assert.ok(box.textContent.includes("Short answer from one official page."), "the required line");
  assert.ok(box.textContent.includes(ut.permit), "the permit line comes from the file");
  assert.ok(box.textContent.includes(ut.hours), "the hours line comes from the file");
  const tel = box.querySelector('a[href^="tel:"]');
  assert.ok(tel, "the phone is a tel: link");
  assert.equal(tel.getAttribute("href"), "tel:+1" + digits(ut.phone));
  const src = box.querySelector(`a[href="${ut.url}"]`);
  assert.ok(src, "the source link goes to the official page in the file");
  assert.match(src.getAttribute("href"), /^https:\/\//);
  assert.doesNotMatch(box.textContent, /undefined|NaN/);
});

test("p6-younger-1: every other state's short card is built from its own file row, and no card says undefined", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(120);
  const box = document.getElementById("otherLite");
  for (const s of lite.states) {
    pick(window, document, s.id);
    for (let i = 0; i < 80 && (box.hidden || !box.textContent.includes(s.name)); i++) await tick(25); // the card fills after the data file arrives; a slow machine needs longer
    assert.equal(box.hidden, false, `${s.id} card shown`);
    assert.ok(box.textContent.includes(s.name), `${s.id} names the state`);
    assert.ok(box.textContent.includes(s.permit), `${s.id} permit line`);
    assert.ok(box.textContent.includes(s.hours), `${s.id} hours line`);
    const tel = box.querySelector('a[href^="tel:"]');
    if (s.phone === NS) {
      assert.equal(tel, null, `${s.id} has no tel link when the phone is not stated`);
      assert.ok(box.textContent.includes(NS), `${s.id} says the phone is not stated`);
    } else {
      assert.equal(tel.getAttribute("href"), "tel:+1" + digits(s.phone), `${s.id} tel link`);
    }
    assert.ok(box.querySelector(`a[href="${s.url}"]`), `${s.id} source link`);
    assert.doesNotMatch(box.textContent, /undefined|NaN/, `${s.id} has no undefined text`);
  }
});

test("p6-younger-1: a full state hides the short card, and All four states hides it too", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(120);
  const box = document.getElementById("otherLite");
  pick(window, document, "ut"); await tick(120);
  assert.equal(box.hidden, false);
  pick(window, document, "ny"); await tick(40);
  assert.equal(box.hidden, true, "New York has its own full answer");
  pick(window, document, "ut"); await tick(120);
  pick(window, document, ""); await tick(40);
  assert.equal(box.hidden, true);
  assert.equal(box.innerHTML, "");
});

test("p6-younger-1: the status line names the short-answer state and still says all for All four states", async () => {
  const { document, window } = await loadPage("younger.html"); await tick(120);
  const st = document.getElementById("yStatus");
  pick(window, document, "ut"); await tick(120);
  assert.match(st.textContent, /Utah/);
  assert.match(st.textContent, /short answer/);
  pick(window, document, "");
  assert.match(st.textContent, /all/i);
});

test("p6-younger-1: a state from the address (?state=ut) shows its short card on load", async () => {
  const { document } = await loadPage("younger.html", { search: "?state=ut" }); await tick(200);
  assert.equal(document.getElementById("yState").value, "ut");
  assert.equal(document.getElementById("otherLite").hidden, false);
  assert.match(document.getElementById("otherLite").textContent, /Short answer from one official page\./);
});

test("p6-younger-1: an unknown ?state=xx still leaves All four states and no short card", async () => {
  const { document } = await loadPage("younger.html", { search: "?state=xx" }); await tick(200);
  assert.equal(document.getElementById("yState").value, "");
  assert.equal(document.getElementById("otherLite").hidden, true);
});

test("p6-younger-1: states-lite.json is not fetched on first load, only after a pick of one of its states", async () => {
  const seen = [];
  const { document, window } = await loadPage("younger.html", { fetchLog: seen, lazy: true }); await tick(200);
  const liteUrls = () => seen.filter((r) => /states-lite\.json/.test(r.url));
  assert.equal(liteUrls().length, 0, "no fetch on first load");
  pick(window, document, "ca"); await tick(120);
  assert.equal(liteUrls().length, 0, "a full state does not fetch the file");
  pick(window, document, "ut"); await tick(200);
  assert.equal(liteUrls().length, 1, "one fetch after picking Utah");
});

test("p6-younger-1: the 'Any other state' card still comes first among the main headings", async () => {
  const { document } = await loadPage("younger.html"); await tick(120);
  const h2s = [...document.querySelectorAll("main h2")];
  assert.equal(h2s[0].id, "otherStateH");
});

test("p6-younger-1: the page source and script have no dash characters", () => {
  for (const f of ["src/younger.html", "assets/js/younger.js", "younger.html"]) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.doesNotMatch(text, /[\u2013\u2014]/, f);
  }
});
