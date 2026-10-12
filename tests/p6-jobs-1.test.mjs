// Ticket p6-jobs-1: Jobs page lists every state, splits local from nationwide, uses the shorter state answers for hours,
// folds older postings, and shows a general getting-there box.
// Run with: node --test tests/p6-jobs-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick, type } from "./dom-helper.mjs";
const read = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url)));
const d = read("data/employers.json"), permits = read("data/permits.json"), lite = read("data/states-lite.json");
const nameOf = (id) => (permits.states[id] || lite.states.find((s) => s.id === id)).name;

test("employers.json: every employer has a where list (a missing one would count as nationwide)", () => {
  for (const e of d.employers) assert.ok(Array.isArray(e.where) && e.where.length > 0, e.id + " lacks where");
});

test("picker lists all 50 states, DC and British Columbia", async () => {
  const { document } = await loadPage("jobs.html"); await tick(200);
  const opts = [...document.querySelectorAll("#jState option")];
  assert.equal(opts[0].textContent, "Anywhere");
  assert.equal(opts.length, 1 + 50 + 1 + 1);
  const t = opts.map((o) => o.textContent);
  for (const n of ["Tennessee", "Florida", "Minnesota", "Utah", "Colorado", "Alaska", "District of Columbia", "British Columbia"]) assert.ok(t.includes(n), n);
  const ids = new Set(opts.slice(1).map((o) => o.value.toLowerCase()));
  for (const s of [...Object.keys(permits.states), ...lite.states.map((x) => x.id)]) assert.ok(ids.has(s), s);
});

test("a state with no local employer still can be picked and shows the few-local card and the nationwide group", async () => {
  const { document } = await loadPage("jobs.html?age=16&state=TN"); await tick(250);
  assert.equal(document.getElementById("jState").value, "TN");
  const card = document.getElementById("jFewLocal");
  assert.ok(card);
  const n = d.employers.filter((e) => e.min_age <= 16 && e.where.includes("TN")).length;
  assert.equal(card.textContent, "We list only " + n + " local " + (n === 1 ? "job" : "jobs") + " for Tennessee so far. The nationwide chains below hire by store: call or walk in.");
  const m = d.employers.filter((e) => e.min_age <= 16 && e.where.includes("US")).length;
  assert.equal(document.getElementById("jscope-jn").textContent, "Nationwide, check your own store (" + m + ")");
});

test("with enough local jobs there are two headings with counts and no few-local card", async () => {
  const { document } = await loadPage("jobs.html?age=16&state=OH"); await tick(250);
  const n = d.employers.filter((e) => e.min_age <= 16 && e.where.includes("OH")).length;
  assert.ok(n >= 3);
  assert.equal(document.getElementById("jscope-jl").textContent, "In Ohio (" + n + ")");
  assert.match(document.getElementById("jscope-jn").textContent, /^Nationwide, check your own store \(\d+\)$/);
  assert.equal(document.getElementById("jFewLocal"), null);
});

test("a state missing from permits.json shows hours, permit, a tel link and the source from states-lite.json", async () => {
  const log = [];
  const { document } = await loadPage("jobs.html?age=15&state=UT", { fetchLog: log }); await tick(400);
  const ut = lite.states.find((s) => s.id === "ut");
  const box = document.getElementById("jHoursBox");
  assert.ok(box.textContent.includes(ut.hours.slice(0, 40)), box.textContent);
  assert.ok(box.textContent.includes(ut.permit.slice(0, 40)));
  assert.ok(box.querySelector('a[href="tel:8015307609"]'));
  assert.ok(box.querySelector('a[href="' + ut.url + '"]'));
  assert.ok(box.querySelector('a[href^="permit.html?state=ut"]'));
  assert.equal(log.filter((r) => /states-lite\.json/.test(r.url)).length, 1);
  assert.equal(nameOf("ut"), "Utah");
});

test("a state in permits.json does not fetch states-lite.json; the permit finder is the last fallback if it fails", async () => {
  const log = [];
  const { document } = await loadPage("jobs.html?age=15&state=OH", { fetchLog: log }); await tick(300);
  assert.equal(log.filter((r) => /states-lite\.json/.test(r.url)).length, 0);
  const { document: d2 } = await loadPage("jobs.html?age=15&state=UT", {
    setup(w) { let real; Object.defineProperty(w, "fetch", { configurable: true, get: () => (u, i) => /states-lite\.json/.test(String(u)) ? Promise.reject(new Error("down")) : real(u, i), set: (f) => { real = f; } }); },
  }); await tick(400);
  assert.ok(d2.querySelector('#jHoursBox a[href^="permit.html?state=ut"]'));
});

test("older postings go in a closed details inside their group", async () => {
  const { document } = await loadPage("jobs.html?age=16&state=CA"); await tick(250);
  const old = [...document.querySelectorAll("details.jOld")];
  assert.ok(old.length > 0);
  for (const dt of old) {
    assert.equal(dt.open, false);
    assert.equal(dt.querySelector("summary").textContent, "Older postings (check first)");
    assert.ok(dt.querySelector(".card"));
  }
  const inFold = old.flatMap((dt) => [...dt.querySelectorAll(".card h3")].map((h) => h.textContent));
  assert.ok(inFold.includes("San Jose seasonal lifeguard") || inFold.some((n) => /San Jose/.test(n)), inFold.join("|"));
  /* A current posting is not folded. */
  const e = d.employers.find((x) => x.id === "fareway");
  assert.ok(e && !inFold.includes(e.name));
});

test("getting-there box shows for every state, with ride links only for the six cities", async () => {
  const { window, document } = await loadPage("jobs.html?age=16&state=AK"); await tick(250);
  const help = document.getElementById("jHelp");
  assert.match(help.textContent, /Getting there without a car: put the employer address into your city transit agency trip planner, check the last bus time against your shift end, and ask your school office about a youth pass\./);
  assert.equal(help.querySelectorAll('a[href^="ready.html?ride="]').length, 0);
  type(window, document.getElementById("jState"), "NY");
  assert.ok(document.getElementById("jHelp").querySelector('a[href="ready.html?ride=nyc"]'));
  type(window, document.getElementById("jState"), "TN");
  assert.match(document.getElementById("jHelp").textContent, /youth pass/);
});
