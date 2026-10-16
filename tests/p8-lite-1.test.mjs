import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const NS = "Not stated on the page we read.";
async function pick(lite, age) {
  const p = await loadPage("permit.html"); await tick();
  const d = p.document;
  type(p.window, d.getElementById("pState"), "lite"); await tick(); await tick(40);
  type(p.window, d.getElementById("pLite"), lite);
  type(p.window, d.getElementById("pAge"), age);
  type(p.window, d.getElementById("pKind"), "job");
  await tick(); await tick(40);
  return p;
}

// 2026-10-16 (persona r11): Arizona was this test's "nothing stated" example until its row was re-read from the
// Industrial Commission of Arizona FAQ. South Dakota (no youngest age or permit stated) and Rhode Island (no office
// stated) carry the placeholder checks now, and Arizona gets its own test of the real answer below.
test("p8-lite-1: unstated rows print plain lines, never the raw placeholder (South Dakota, Rhode Island)", async () => {
  // Ticket p8-permit-lite-print: each unstated row now ends with a plain next step and the state page link.
  const NEXT = " Ask your school office or the state labor office. Their page is linked here.";
  const plain = (r) => r.textContent.replace(/ \(opens in a new tab\)/g, "");
  const rowsOf = (card) => [...card.querySelectorAll("dl.facts > div")].map((r) => r.querySelector("dd"));
  const sd = (await pick("sd", "15")).document.getElementById("pLiteCard"), rows = rowsOf(sd);
  assert.ok(plain(rows[0]).startsWith("We did not find a minimum age on the state page we read. Federal law sets 14 for most non-farm jobs. Your state may set a higher age." + NEXT));
  assert.equal(rows[0].querySelector("a").getAttribute("href"), "https://www.dol.gov/agencies/whd/fact-sheets/43-child-labor-non-agriculture");
  assert.ok(plain(rows[1]).startsWith("We did not find a work permit answer on the state page we read. Ask the state labor office before the first shift." + NEXT));
  assert.match(rows[1].querySelector("[data-liteask] a").getAttribute("href"), /^https:\/\//);
  for (const i of [0, 1]) assert.ok(rows[i].classList.contains("ns"));
  assert.doesNotMatch(sd.textContent, /Not stated on the page we read/);
  // South Dakota's hours text names a 4 hour school day, not 3, so the federal line is added.
  assert.ok(sd.querySelector("#pFedLine"));
  const ri = (await pick("ri", "15")).document.getElementById("pLiteCard"), who = rowsOf(ri)[3];
  assert.equal(who.textContent, "Not listed on the page we read. Call the state labor department.");
  assert.ok(who.classList.contains("ns"));
  assert.doesNotMatch(ri.textContent, /Not stated on the page we read/);
});

test("p8-lite-1: Arizona answers the permit question with the office and tap-to-call numbers (persona r11)", async () => {
  const p = await pick("az", "15"); const card = p.document.getElementById("pLiteCard");
  const rows = [...card.querySelectorAll("dl.facts > div")].map((r) => r.querySelector("dd"));
  assert.match(rows[1].textContent, /^No\. Arizona does not require a work permit for anyone under 18\./);
  assert.match(rows[0].textContent, /^Arizona's youth employment law \(A\.R\.S\. 23-230 to 23-242\) sets no general youngest age\./);
  for (const i of [0, 1, 2, 3]) assert.ok(!rows[i].classList.contains("ns"), "row " + i + " is stated");
  const tels = [...rows[3].querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute("href"));
  assert.deepEqual(tels.sort(), ["tel:+15206285459", "tel:+16025424661"]);
  assert.ok(rows[3].querySelector('a[href="mailto:LaborAdmin@azica.gov"]'));
  assert.match(rows[3].textContent, /Industrial Commission of Arizona, Labor Department/);
  // The quote is a whole sentence now (it was cut off mid sentence before).
  assert.match(card.textContent, /The page says: \u201cWork permits are not required in the State of Arizona\.\u201d/);
  assert.equal(card.querySelector("#pFedLine"), null, "Arizona's hours text names the 3 hour school day");
  assert.doesNotMatch(card.textContent, /We did not find|Not listed on the page we read|Not stated on the page we read/);
});

test("p8-lite-1: Nevada at 14 gets the federal hours line from employers.json", async () => {
  const p = await pick("nv", "14"); const card = p.document.getElementById("pLiteCard");
  const f = card.querySelector("#pFedLine");
  assert.ok(f);
  assert.match(f.textContent, /^Federal rules also apply: .*no more than 3 hours on a school day.*Where your state is stricter, the state rule wins\./);
  assert.equal(f.querySelector("a").getAttribute("href"), "https://www.dol.gov/agencies/whd/youthrules/young-workers/non-ag-14-15");
  const q = await pick("nv", "16");
  assert.equal(q.document.getElementById("pLiteCard").querySelector("#pFedLine"), null);
});

test("p8-lite-1: Nevada wage has no federal floor sentence and shows the source date for a stated date", async () => {
  const p = await pick("nv", "15");
  const w = p.document.querySelector(".stateWage");
  assert.ok(w);
  assert.doesNotMatch(w.textContent, /federal \$7\.25/);
});

test("p8-lite-1: Georgia wage below 7.25 adds the fixed federal sentence and the table date wording", async () => {
  const p = await loadPage("jobs.html", { search: "?state=ga&age=15" }); await tick(); await tick(60);
  const w = p.document.querySelector(".stateWage");
  assert.ok(w, "wage line shown");
  assert.match(w.textContent, /\$5\.15 an hour/);
  assert.ok(w.textContent.includes("Employers covered by federal law pay the federal rate instead."));
  assert.doesNotMatch(w.textContent, /Most employers must pay at least the federal/);
  assert.match(w.textContent, /Source table dated July 1, 2026\./);
  assert.doesNotMatch(w.textContent, /Table updated/);
});

test("p8-lite-1: wageLine unit checks", async () => {
  const p = await loadPage("permit.html"); await tick();
  const G = p.window.TIG;
  const wd = { states: [
    { id: "a", wage: "$7.25 an hour.", youth: "x", effective: "Table updated July 1, 2026", url: "https://example.org/", page_title: "T" },
    { id: "b", wage: "$5.15 an hour.", youth: "x", effective: "The page does not say.", url: "https://example.org/", page_title: "T", below_federal: true },
    // The first dollar figure is a tipped rate, not the base rate, and the row is not flagged, so no federal sentence.
    { id: "c", wage: "$2.13 an hour for tipped workers. The base rate is $10.85 an hour.", youth: "x", effective: "The page does not say.", url: "https://example.org/", page_title: "T" },
    // A flagged row whose first figure is not the base rate: the flag decides, and the sentence shows.
    { id: "d", wage: "$2.13 an hour for tipped workers. The base rate is $5.15 an hour.", youth: "x", effective: "The page does not say.", url: "https://example.org/", page_title: "T", below_federal: true } ] };
  const a = G.wageLine(wd, "a"), b = G.wageLine(wd, "b"), c = G.wageLine(wd, "c"), d = G.wageLine(wd, "d");
  assert.ok(!a.includes("federal $7.25"));
  assert.ok(a.includes("Source table dated July 1, 2026."));
  assert.ok(b.includes("Employers covered by federal law pay the federal rate instead."));
  assert.ok(!b.includes("$7.25"));
  assert.ok(!b.includes("Source table dated"));
  assert.ok(!c.includes("Employers covered by federal law"), "a first figure that is not the base rate does not add the sentence");
  assert.ok(d.includes("Employers covered by federal law pay the federal rate instead."), "the flag decides, not the first figure");
});

// 2026-10-16: Rhode Island (no permit or phone stated) replaces Arizona here; Arizona's row now states both.
test("p8-lite-1: Jobs hours strip for an unstated state shows plain permit and phone lines", async () => {
  const p = await loadPage("jobs.html", { search: "?state=ri&age=15" }); await tick(); await tick(60);
  const box = p.document.getElementById("jHoursBox");
  assert.ok(box);
  assert.match(box.textContent, /We did not find a work permit answer on the state page we read\. Ask the state labor office before the first shift\./);
  assert.match(box.textContent, /Not listed on the page we read\. Call the state labor department\./);
  assert.ok(!box.textContent.includes("Not stated on the page we read. "), "phone/permit placeholder gone");
});

test("p8-lite-1: Jobs hours strip for Arizona shows the permit answer and the Phoenix number (persona r11)", async () => {
  const p = await loadPage("jobs.html", { search: "?state=az&age=15" }); await tick(); await tick(60);
  const box = p.document.getElementById("jHoursBox");
  assert.ok(box);
  assert.match(box.textContent, /Work permit\. No\. Arizona does not require a work permit/);
  assert.ok(box.querySelector('a[href="tel:6025424661"]'), "jobs.js telLink uses the bare 10 digits");
  assert.doesNotMatch(box.textContent, /We did not find|Not listed on the page we read/);
});
