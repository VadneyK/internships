// Ticket p5-jobs-1: Jobs page state picker, hours strip, no-results help, ride and scam lines.
// Run with: node --test tests/p5-jobs-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick, type } from "./dom-helper.mjs";
const read = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url)));
const d = read("data/employers.json"), permits = read("data/permits.json"), transit = read("data/transit.json");

test("employers.json: every entry has a where array of two-letter codes or US, and the group is renamed", () => {
  for (const e of d.employers) {
    assert.ok(Array.isArray(e.where) && e.where.length > 0, e.id + " where");
    for (const w of e.where) assert.match(w, /^[A-Z]{2}$/, e.id + " code " + w);
    if (e.where.includes("US")) assert.deepEqual(e.where, ["US"], e.id);
  }
  assert.ok(d.employers.some((e) => e.where.includes("US")) && d.employers.some((e) => !e.where.includes("US")));
  const g = d.groups.find((x) => x[0] === "grocery");
  assert.equal(g[1], "Grocery and retail");
  assert.doesNotMatch(JSON.stringify(d), /Grocery stores and shops/);
});

const stateOptions = (document) => [...document.querySelectorAll("#jState option")].map((o) => o.textContent);

test("jobs: state is a plain select (no tile wall) that starts with Anywhere, then states; picking Ohio hides other states and keeps nationwide chains", async () => {
  const { window, document, errors } = await loadPage("jobs.html?age=16"); await tick(200);
  assert.equal(document.querySelector("#jState + .tp"), null, "no tile picker on the state select");
  assert.ok(document.querySelector('label[for="jState"]') && document.getElementById("jStateHint"), "label and hint");
  assert.equal(document.getElementById("jState").getAttribute("aria-describedby"), "jStateHint");
  const t = stateOptions(document);
  assert.equal(t[0], "Anywhere");
  assert.ok(t.includes("Ohio") && t.includes("Georgia") && t.includes("New York"));
  type(window, document.getElementById("jState"), "OH");
  const shown = [...document.querySelectorAll("#jOut > .grid .card h3")].map((h) => h.textContent);
  const want = d.employers.filter((e) => e.min_age <= 16 && (e.where.includes("OH") || e.where.includes("US"))).map((e) => e.name);
  assert.ok(want.includes("Cedar Point"));
  assert.deepEqual(shown.sort(), want.sort());
  assert.ok(!shown.includes("Hersheypark"));
  assert.match(new URL(window.location.href).search, /state=OH/);
  assert.deepEqual(errors, []);
});

test("jobs: ?state= link sets the state and the hours strip shows that state's hours for the age", async () => {
  const { document } = await loadPage("jobs.html?age=15&state=ny"); await tick(200);
  assert.equal(document.getElementById("jState").value, "NY");
  const strip = document.getElementById("jHours").textContent;
  assert.ok(strip.includes(permits.states.ny.hours["14"].slice(0, 40)), strip);
  assert.ok(document.querySelector('#jHours a[href^="permit.html?state=ny"]'));
});

test("jobs: the saved Where place sets the state", async () => {
  const { document } = await loadPage("jobs.html", { storage: { findprefs: { place: "city:atlanta" } } });
  await tick(200);
  assert.equal(document.getElementById("jState").value, "GA");
});

test("jobs: a state only in the shorter answers shows them and keeps the permit finder link", async () => {
  const { document } = await loadPage("jobs.html?age=16&state=UT"); await tick(200);
  assert.equal(permits.states.ut, undefined);
  const strip = document.getElementById("jHours");
  /* Utah is in states-lite.json (the shorter answers), so its hours show; the finder link stays as the last line. */
  assert.match(strip.textContent, /Hours in Utah/);
  assert.ok(strip.querySelector('a[href="permit.html?state=ut&age=16"]'));
});

test("jobs: no matches for the age and state shows the help card with the three ideas and links", async () => {
  /* The real list always has a nationwide chain at 14, so a copy with only older ages is served to reach the empty case. */
  const setup = (w) => {
    const real = (u, o) => {
      const url = new URL(String(u), w.location.href);
      return fetch(url, o).then(async (r) => {
        if (!/data\/employers\.json/.test(url.pathname)) return r;
        const j = await r.json(); j.employers = j.employers.filter((e) => e.min_age >= 16);
        return new Response(JSON.stringify(j), { status: 200 });
      });
    };
    Object.defineProperty(w, "fetch", { get: () => real, set: () => {}, configurable: true });
  };
  const { document } = await loadPage("jobs.html?age=14&state=GA", { setup }); await tick(200);
  const card = document.getElementById("jNone");
  assert.ok(card, "help card");
  assert.match(card.textContent, /no verified places for age 14 in Georgia/i);
  assert.match(card.textContent, /family friend/i);
  assert.match(card.textContent, /with a parent/i);
  for (const h of ["younger.html", "find.html?age=14", "permit.html?age=14"]) assert.ok(card.querySelector('a[href="' + h + '"]'), h);
});

test("jobs: ride line for the six cities and the scam line", async () => {
  const { window, document } = await loadPage("jobs.html?age=16&state=CA"); await tick(200);
  const help = document.getElementById("jHelp");
  const ids = [...help.querySelectorAll('a[href^="ready.html?ride="]')].map((a) => a.getAttribute("href").split("=")[1]);
  assert.deepEqual(ids.sort(), ["bay", "la", "orange", "sandiego"]); // 2026-10-14: plus the Bay Area and Sacramento table
  assert.match(help.textContent, /Getting there without a car/);
  assert.match(help.textContent, /Never pay to get a job/);
  assert.match(help.textContent, /Never send your ID to a stranger/);
  assert.match(help.textContent, /Tell an adult before an interview/);
  assert.ok(help.querySelector('a[href="safety.html"]'));
  type(window, document.getElementById("jState"), "OH");
  assert.equal(document.getElementById("jHelp").querySelectorAll('a[href^="ready.html?ride="]').length, 0);
  assert.match(document.getElementById("jHelp").textContent, /Never pay/);
});

test("jobs.js ride ids match data/transit.json", () => {
  const src = fs.readFileSync(new URL("../assets/js/jobs.js", import.meta.url), "utf8");
  for (const p of transit.places) assert.ok(src.includes('["' + p.id + '", "' + p.name + '"]'), p.id);
  // 2026-10-14: plus the Bay Area and Sacramento table on ready.html (its ride picker option "bay").
  assert.ok(src.includes('["bay", "Bay Area and Sacramento"]'));
  assert.equal((src.match(/\["[a-z]+", "[A-Za-z ]+"\]/g) || []).length, transit.places.length + 1);
});

test("jobs: the grocery group shows its new name and the small town sentence", async () => {
  const { document } = await loadPage("jobs.html?age=16"); await tick(200);
  const h = document.getElementById("jg-grocery");
  assert.equal(h.textContent, "Grocery and retail");
  assert.equal(h.nextElementSibling.textContent, "Many small town stores are locally owned and not listed. Ask the manager in person.");
});
