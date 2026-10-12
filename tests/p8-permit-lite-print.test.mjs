// Ticket p8-permit-lite-print: shorter-answer states get the same message and print section as the full states.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, type, tick } from "./dom-helper.mjs";

const NEXT = "Ask your school office or the state labor office. Their page is linked here.";
// Read the row at test time: the data file can change between runs.
const row = (id) => JSON.parse(fs.readFileSync(new URL("../data/states-lite.json", import.meta.url), "utf8")).states.find((s) => s.id === id);
const NS = "Not stated on the page we read.";
const needsStep = (v) => !v || v === NS || v.startsWith(NS);

async function pick(lite, age, kind = "job") {
  const p = await loadPage("permit.html"); await tick();
  const d = p.document;
  type(p.window, d.getElementById("pState"), "lite"); await tick(); await tick(40);
  type(p.window, d.getElementById("pLite"), lite);
  type(p.window, d.getElementById("pAge"), age);
  type(p.window, d.getElementById("pKind"), kind);
  // Wait for the card (the machine can be slow), then for the wage file to settle.
  for (let i = 0; i < 100 && !d.getElementById("pLiteCard"); i++) await tick(50);
  await tick(150);
  return p;
}

for (const [id, name] of [["id", "Idaho"], ["ne", "Nebraska"]]) {
  test(`p8-permit-lite-print: ${name} at 15 shows the packet with the state name and source link`, async () => {
    const p = await pick(id, "15"); const d = p.document, r = row(id);
    assert.equal(d.getElementById("packetSec").hidden, false);
    const pk = d.getElementById("pPacket");
    assert.ok(pk.textContent.includes(name));
    assert.match(pk.querySelector("h3").textContent, new RegExp("^Work permit checklist \\(" + name + "\\)$"));
    const a = [...pk.querySelectorAll("a")].find((x) => x.getAttribute("href") === r.url);
    assert.ok(a, "source link in the packet");
    assert.ok(pk.textContent.includes(r.quote));
    assert.doesNotMatch(pk.textContent, /Not stated on the page we read\.(?! The page only)/);
    assert.equal(pk.querySelectorAll("[id]").length, 0, "no repeated ids in the printed sheet");
    // message section is filled and names the state
    assert.match(d.getElementById("mText").textContent, new RegExp("work permit in " + name));
    assert.ok(d.getElementById("mMail").getAttribute("href").startsWith("mailto:"));
    // the card links to the section
    assert.ok(d.querySelector('#pLiteCard a[href="#packetSec"]'));
  });

  test(`p8-permit-lite-print: ${name} print uses printOnly on the packet`, async () => {
    const p = await pick(id, "15"); const G = p.window.TIG;
    const calls = [];
    G.printOnly = (node, title) => calls.push([node.id, title]);
    p.document.getElementById("pPrint").click();
    assert.deepEqual(calls, [["pPacket", "Work permit checklist"]]);
  });
}

test("p8-permit-lite-print: Idaho unstated permit gets the plain next step with the state page link, on screen and printed", async () => {
  const p = await pick("id", "15"); const d = p.document, r = row("id");
  for (const root of [d.getElementById("pLiteCard"), d.getElementById("pPacket")]) {
    assert.ok(root.textContent.includes(NEXT));
    const ask = [...root.querySelectorAll("[data-liteask] a")];
    assert.ok(ask.length >= 2, "permit and hours (both unstated) each carry the step");
    for (const a of ask) assert.equal(a.getAttribute("href"), r.url);
  }
});

test("p8-permit-lite-print: Nebraska packet uses its own row; the next step shows once per unstated field", async () => {
  const p = await pick("ne", "15"); const d = p.document, r = row("ne");
  const pk = d.getElementById("pPacket");
  assert.ok(pk.textContent.includes(r.permit.slice(0, 40)));
  const want = ["min_age", "permit", "hours"].filter((k) => needsStep(r[k])).length;
  assert.equal(pk.querySelectorAll("[data-liteask]").length, want);
  assert.equal(pk.textContent.includes(NEXT), want > 0);
  // the state hours text prints once
  assert.equal(pk.textContent.split(r.hours).length - 1, 1);
});

test("p8-permit-lite-print: no packet at 13, 18 or before an age is picked", async () => {
  for (const age of ["13", "18", ""]) {
    const p = await pick("id", age);
    assert.equal(p.document.getElementById("packetSec").hidden, true, "age " + age);
    assert.equal(p.document.getElementById("pPacket").innerHTML, "");
  }
});

test("p8-permit-lite-print: California is unchanged", async () => {
  const p = await loadPage("permit.html"); await tick();
  const d = p.document;
  type(p.window, d.getElementById("pState"), "ca");
  type(p.window, d.getElementById("pAge"), "15");
  type(p.window, d.getElementById("pKind"), "job");
  await tick(); await tick(40);
  assert.equal(d.getElementById("packetSec").hidden, false);
  assert.equal(d.getElementById("pLiteCard"), null);
  const pk = d.getElementById("pPacket");
  assert.match(pk.querySelector("h3").textContent, /checklist \(California\)/);
  assert.doesNotMatch(pk.textContent, /Ask your school office or the state labor office/);
  assert.match(d.getElementById("mText").textContent, /I think I need a /);
  // moving to a shorter-answer state and back clears the lite packet
  type(p.window, d.getElementById("pState"), "lite"); await tick(); await tick(40);
  assert.equal(d.getElementById("packetSec").hidden, true);
});
