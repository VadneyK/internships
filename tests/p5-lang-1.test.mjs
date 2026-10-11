// Ticket p5-lang-1: Spanish and other languages are easier to find from the parents and home pages.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));

const LINE = "Official pages in Spanish and other languages";
const languages = json("data/languages.json");
const permits = json("data/permits.json");

function spanishLine(document) {
  return [...document.querySelectorAll("#main a[href]")].find((a) => a.textContent.trim() === LINE);
}

test("p5-lang-1: parents page shows the Spanish line and it links to languages.html?lang=es", async () => {
  const { document, errors } = await loadPage("parents.html"); await tick(200);
  assert.deepEqual(errors, []);
  const a = spanishLine(document);
  assert.ok(a, "visible line exists on the parents page");
  assert.equal(a.getAttribute("href"), "languages.html?lang=es");
  assert.equal(a.closest("p").textContent.trim(), LINE);
});

test("p5-lang-1: home page shows the Spanish line and it links to languages.html?lang=es", async () => {
  const { document, errors } = await loadPage("index.html"); await tick(200);
  assert.deepEqual(errors, []);
  const a = spanishLine(document);
  assert.ok(a, "visible line exists on the home page");
  assert.equal(a.getAttribute("href"), "languages.html?lang=es");
});

test("p5-lang-1: the Spanish line is in the static HTML, so it shows even before scripts run", () => {
  for (const f of ["src/parents.html", "src/index.html", "parents.html", "index.html"]) {
    assert.ok(read(f).includes(`<a href="languages.html?lang=es">${LINE}</a>`), `${f} has the line`);
  }
});

test("p5-lang-1: the lang value in the link is a real code in data/languages.json", () => {
  const codes = languages.languages.map((l) => l[0]);
  assert.ok(codes.includes("es"));
});

test("p5-lang-1: languages.js reads ?lang= and ?state= from the address", () => {
  const js = read("assets/js/languages.js");
  assert.match(js, /q\.get\("lang"\)/);
  assert.match(js, /q\.get\("state"\)/);
});

test("p5-lang-1: languages page opens on Spanish with ?lang=es", async () => {
  const { document, errors } = await loadPage("languages.html", { search: "?lang=es" }); await tick(150);
  assert.deepEqual(errors, []);
  assert.equal(document.getElementById("lLang").value, "es");
  assert.match(document.getElementById("lCount").textContent, /in Español|Spanish/);
});

test("p5-lang-1: languages page opens on a place with ?state= using the name from languages.json", async () => {
  const { document, errors } = await loadPage("languages.html", { search: "?state=New%20York" }); await tick(150);
  assert.deepEqual(errors, []);
  assert.equal(document.getElementById("lState").value, "New York");
  assert.match(document.getElementById("lCount").textContent, /for New York/);
});

test("p5-lang-1: the place names used in languages.json match the names in permits.json", () => {
  const permitNames = new Set(Object.values(permits.states).map((s) => s.name));
  const places = [...new Set(languages.rows.map((r) => r.state))].filter((s) => s !== "All states");
  assert.ok(places.length > 0);
  for (const s of places) assert.ok(permitNames.has(s), `"${s}" is a permit place name`);
});
