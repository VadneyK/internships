// Persona round 9 (2026-10-14, teen, parent and leader at the Alameda table): "Good fit for you" keeps the QR code's area,
// cards only some teens can join come last, typed towns find their area, and the calendar link keeps the area.
// Run with: node --test tests/persona-r9-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const byId = Object.fromEntries(DATA.map((e) => [e.id, e]));
const OAK = L.HUBS.find((h) => h[0] === "oak")[2];

async function picksFor(search) {
  const { document, errors } = await loadPage("find.html", { search });
  for (let i = 0; i < 40 && !document.querySelector("#picksList li"); i++) await tick(50);
  return { document, errors, ids: [...document.querySelectorAll("#picksList [data-jump]")].map((a) => a.getAttribute("data-jump")) };
}

for (const search of ["?where=oak&age=17", "?where=oak&age=15&season=summer&pay=pay"]) {
  test("NorCal QR " + search + ": every pick is in the Oakland and East Bay area", async () => {
    const { document, errors, ids } = await picksFor(search);
    assert.ok(ids.length >= 1, "picks are shown");
    for (const id of ids) assert.ok(byId[id].regions.some((r) => OAK.includes(r)), id + " is outside the area: " + byId[id].regions.join(","));
    assert.match(document.getElementById("picksWhy").textContent, /^Picked from your age and area\./);
    assert.deepEqual(errors, []);
  });
}

test("with only an age the picks say they come from anywhere", async () => {
  const { document } = await picksFor("?age=16");
  assert.match(document.getElementById("picksWhy").textContent, /^Picked from your age, from anywhere\./);
});

test("cards limited to one city's residents or one gender are marked in the lite data and are not picked first", async () => {
  const lite = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries-lite.json"), "utf8"));
  const lim = new Set(lite.filter((e) => e.limited).map((e) => e.id));
  assert.ok(lim.has("berkeley-youthworks"), "Berkeley residents only");
  assert.ok(lim.has("oakland-mayors-summer-youth-employment-program"), "must live in Oakland");
  assert.ok(!lim.has("bgc-oakland-junior-staff"), "Boys and Girls Club is open to all");
  const { ids } = await picksFor("?where=oak&age=17");
  const firstLimited = ids.findIndex((id) => lim.has(id));
  if (firstLimited > -1) assert.ok(ids.slice(firstLimited).every((id) => lim.has(id)), "limited cards only fill the end");
});

test("typed towns find the Where choice that covers them", async () => {
  const { window, document } = await loadPage("find.html");
  for (let i = 0; i < 40 && document.getElementById("place").options.length < 2; i++) await tick(50);
  const q = document.querySelector('input[role="combobox"]');
  for (const [town, want] of [["Fremont", "Silicon Valley and San Jose"], ["Alameda", "Berkeley and the East Bay"], ["Oakland", "Berkeley and the East Bay"], ["Hayward", "Berkeley and the East Bay"], ["Anaheim", "Irvine, Costa Mesa and Orange County"]]) {
    q.value = town; q.dispatchEvent(new window.Event("input", { bubbles: true }));
    await tick(20);
    const first = document.querySelector(".combo-opt");
    assert.ok(first && first.textContent.startsWith(want), town + " gave " + (first && first.textContent));
  }
});

test("the calendar link keeps the QR code's area", async () => {
  const { document } = await picksFor("?where=oak&age=17");
  const box = document.getElementById("relatedLinks");
  assert.equal(box.querySelector("a[href^='calendar.html']").getAttribute("href"), "calendar.html?at=city%3Aberkeley&age=17");
});

test("a card with no stated age says so instead of claiming all high school ages", () => {
  assert.equal(L.ageText({}), "Age not stated");
});

test("a card only some teens can join says so on its face", async () => {
  const { document } = await loadPage("find.html", { search: "?where=oak&age=15" });
  for (let i = 0; i < 40 && !document.getElementById("p-berkeley-youthworks"); i++) await tick(50);
  const card = document.getElementById("p-berkeley-youthworks");
  assert.ok(card, "Berkeley YouthWorks is listed");
  assert.ok([...card.querySelectorAll(".tag.warn")].some((t) => t.textContent === "Only some can apply: see who below"));
});

test("handout: the table plan has its own QR code and prints alone", async () => {
  const { document, window } = await loadPage("handout.html");
  window.print = () => {};
  const table = document.getElementById("table");
  assert.ok(table.querySelector('img[src="assets/qr/home.svg"]'), "the plan that says scan the QR code on this page has one");
  document.getElementById("handoutPrintTable").click();
  const root = document.getElementById("printRoot");
  assert.ok(root && root.textContent.includes("Run it as a 30 minute table"));
  assert.ok(!root.textContent.includes("Teach it in 45 minutes"));
  window.dispatchEvent(new window.Event("afterprint"));
});

test("home: the leader card links the table plan and the QR codes", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(html.includes('href="handout.html#table"') && html.includes('href="share.html">QR codes to print'));
});

test("Copy my list gives a parent ages, pay, who can apply and dates, in the order saved", async () => {
  const ids = ["berkeley-youthworks", "kode-with-klossy"];
  const { window, document } = await loadPage("find.html", { storage: { saved: ids.slice().reverse() } });
  for (let i = 0; i < 60 && !(document.getElementById("copyList") && document.querySelector(".prog")); i++) await tick(50);
  const written = [];
  Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText: (t) => { written.push(t); return Promise.resolve(); } } });
  document.getElementById("copyList").click();
  await tick(50);
  const t = written[0] || "";
  assert.ok(t.startsWith("https://vadneyk.github.io/internships/\n"), t.slice(0, 80));
  assert.match(t, /Berkeley YouthWorks[^\n]*\n  Age not stated\. Paid\. Only some can apply: check who\.\n  Dates: /);
  assert.ok(t.indexOf("Kode With Klossy") < t.indexOf("Berkeley YouthWorks"), "saved order: the list was saved Kode With Klossy first");
});
