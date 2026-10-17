// 2026-10-17: permit.js answers that a mutation run of the page (CI run 39008427088, permit.js and paycheck.js with
// 15 jsdom files) showed no test pinned. Worst for a teen first: the "no permit at this age" line and the under-16
// details (Georgia), British Columbia's plain answer at 14 and 15, the short-answer card's age lines (under 14,
// 16 and 17 hours, the kind of work it does not cover), the 18+ and under-14 answers for a state we have not read,
// the saved Programs area and age, and the share link.
// Run with: node --test tests/r10-tests-2-mut-permit-page.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, type, tick, waitFor } from "./dom-helper.mjs";

const LITE = JSON.parse(fs.readFileSync(new URL("../data/states-lite.json", import.meta.url), "utf8")).states;
const NS = "Not stated on the page we read.";
const has1617 = (s) => !!s.hours && s.hours !== NS && s.hours.split(/[.;:!?]/).some((p) => /\b16\b/.test(p) && /\b17\b/.test(p));
const LITE_WITH = LITE.find(has1617).id;
const LITE_WITHOUT = LITE.find((s) => !has1617(s)).id;

async function open(opts = {}) {
  const p = await loadPage("permit.html", opts);
  await waitFor(() => p.document.getElementById("pKind").options.length > 1);
  return p;
}
async function full(st, age, kind) {
  const p = await open();
  const d = p.document;
  type(p.window, d.getElementById("pState"), st);
  type(p.window, d.getElementById("pAge"), age);
  type(p.window, d.getElementById("pKind"), kind);
  await waitFor(() => d.querySelector("#pOut article"));
  return p;
}
async function lite(id, age, kind = "job") {
  const p = await open();
  const d = p.document;
  type(p.window, d.getElementById("pState"), "lite");
  await waitFor(() => d.getElementById("pLite").options.length > 2);
  type(p.window, d.getElementById("pLite"), id);
  type(p.window, d.getElementById("pAge"), age);
  type(p.window, d.getElementById("pKind"), kind);
  await waitFor(() => d.getElementById("pLiteCard"));
  return p;
}
const out = (p) => p.document.getElementById("pOut");

test("Georgia at 16: no permit line and the under-16 details; at 15 the permit answer; volunteering is not past a cut-off", async () => {
  const at16 = await full("ga", "16", "job");
  assert.ok(out(at16).querySelector("#pNoPermitLine"), "16 is past Georgia's permit age");
  assert.match(out(at16).querySelector("#pUnder summary").textContent, /^If you were under 16$/);
  assert.ok(out(at16).querySelector("article.verdict.none"));
  assert.equal(out(at16).querySelector(".tag").textContent, "No permit");
  assert.equal(out(at16).querySelector('a[href="#packetSec"]'), null, "no message or checklist when no permit is needed");
  at16.window.close();

  const at15 = await full("ga", "15", "job");
  assert.equal(out(at15).querySelector("#pNoPermitLine"), null);
  assert.equal(out(at15).querySelector("#pUnder"), null);
  assert.ok(out(at15).querySelector("article.verdict.need"));
  assert.equal(out(at15).querySelector(".tag").textContent, "You need one");
  assert.ok(out(at15).querySelector(".tag.y"));
  assert.ok(out(at15).querySelector('a[href="#packetSec"]'), "the jump to the message and checklist");
  at15.window.close();

  const vol = await full("ga", "16", "volunteer");
  assert.ok(out(vol).querySelector("article.verdict.none"));
  assert.equal(out(vol).querySelector("#pNoPermitLine"), null, "volunteering needs no permit at any age, so no cut-off line");
  assert.equal(out(vol).querySelector("#pUnder"), null);
  vol.window.close();
});

test("British Columbia: the plain three-step answer at 14 and 15 for a job, not at 16 or for volunteering", async () => {
  for (const age of ["14", "15"]) {
    const p = await full("bc", age, "job");
    const plain = out(p).querySelector("#pBcPlain");
    assert.ok(plain, "BC " + age);
    assert.equal(plain.querySelector("h3").textContent, "Your answer in British Columbia at " + age);
    assert.ok(plain.querySelectorAll("li").length >= 3);
    p.window.close();
  }
  for (const [age, kind] of [["16", "job"], ["13", "job"], ["14", "volunteer"]]) {
    const p = await full("bc", age, kind);
    assert.equal(out(p).querySelector("#pBcPlain"), null, "BC " + age + " " + kind);
    p.window.close();
  }
});

test("a full-state answer at 12: the younger page link carries the state only for the four states that page covers", async () => {
  const ca = await full("ca", "12", "job");
  assert.equal(out(ca).querySelector('a.btn[href^="younger.html"]').getAttribute("href"), "younger.html?state=ca&age=12");
  ca.window.close();
  const wa = await full("wa", "13", "job");
  assert.equal(out(wa).querySelector('a.btn[href^="younger.html"]').getAttribute("href"), "younger.html?age=13");
  wa.window.close();
});

test("short answer: under 14 points to the Ages 12 to 14 page and says the federal rule", async () => {
  const p = await lite(LITE_WITHOUT, "13");
  const card = p.document.getElementById("pLiteCard");
  assert.equal(card.querySelector("#pAgeLine a").getAttribute("href"), "younger.html?age=13");
  assert.match(card.textContent, /Federal law says under 14 may not be employed in most non-farm jobs/);
  assert.equal(card.querySelector('a.btn[href="younger.html?age=13"]').textContent, "What you can do at 12 and 13");
  assert.equal(card.querySelector('a[href="#packetSec"]'), null, "the message and checklist start at 14");
  assert.equal(p.document.getElementById("packetSec").hidden, true);
  p.window.close();

  const at14 = await lite(LITE_WITHOUT, "14");
  const c14 = at14.document.getElementById("pLiteCard");
  assert.doesNotMatch(c14.textContent, /Federal law says under 14 may not be employed/);
  assert.ok(c14.querySelector('a[href="#packetSec"]'));
  assert.equal(at14.document.getElementById("packetSec").hidden, false);
  at14.window.close();
});

test("short answer: 16 and 17 are told when the hours row may not cover them; 15 is not", async () => {
  for (const age of ["16", "17"]) {
    const p = await lite(LITE_WITHOUT, age);
    assert.match(p.document.getElementById("pLiteNote").textContent, /The hours row may not cover 16 and 17 year olds\./, LITE_WITHOUT + " " + age);
    assert.ok(p.document.querySelector('#pLiteCard a[href="#packetSec"]'), "17 still gets the checklist");
    p.window.close();
  }
  const ok = await lite(LITE_WITH, "16");
  assert.equal(ok.document.getElementById("pLiteNote"), null, LITE_WITH + " states hours for 16 and 17");
  assert.match(ok.document.getElementById("pAgeLine").textContent, /The hours row below states limits for 16 and 17/);
  ok.window.close();
  const fifteen = await lite(LITE_WITHOUT, "15");
  assert.equal(fifteen.document.getElementById("pLiteNote"), null);
  fifteen.window.close();
});

test("short answer: a kind of work other than a job is named as not covered; 18 gets the adult line and no checklist", async () => {
  const p = await lite(LITE_WITHOUT, "15", "volunteer");
  assert.match(p.document.getElementById("pLiteNote").textContent, /This short answer does not cover the kind of work you picked\./);
  p.window.close();
  const adult = await lite(LITE_WITHOUT, "18");
  assert.match(adult.document.getElementById("pAdultLine").textContent, /You are 18\. You do not need a minor work permit\./);
  assert.equal(adult.document.querySelector('#pLiteCard a[href="#packetSec"]'), null);
  assert.equal(adult.document.getElementById("packetSec").hidden, true);
  adult.window.close();
});

test("a state we have not read: 18 is the adult line, 12 and 13 the federal rule, 15 the ask-your-office answer", async () => {
  const cases = [["18", /You are 18\. You do not need a minor work permit\./], ["12", /Federal law says under 14 may not be employed/], ["13", /Federal law says under 14 may not be employed/], ["15", /We have not read your state yet/]];
  for (const [age, re] of cases) {
    const p = await full("other", age, "job");
    assert.match(out(p).textContent, re, "age " + age);
    if (age === "15") assert.doesNotMatch(out(p).textContent, /Federal law says under 14/);
    p.window.close();
  }
});

test("the short-answer list's 'My state is not listed' gives the same answer as in the first list", async () => {
  const p = await open();
  const d = p.document;
  type(p.window, d.getElementById("pState"), "lite");
  await waitFor(() => d.getElementById("pLite").options.length > 2);
  type(p.window, d.getElementById("pAge"), "15");
  type(p.window, d.getElementById("pKind"), "job");
  type(p.window, d.getElementById("pLite"), "other");
  await waitFor(() => d.getElementById("pState").value === "other");
  assert.equal(d.getElementById("pLite").value, "");
  assert.match(out(p).textContent, /We have not read your state yet/);
  p.window.close();
});

test("the prompt names exactly what is still missing", async () => {
  const p = await open();
  const d = p.document;
  assert.equal(out(p).textContent.trim(), "Pick all three to see your answer.");
  type(p.window, d.getElementById("pState"), "ca");
  await waitFor(() => /Now pick/.test(out(p).textContent));
  assert.equal(out(p).textContent.trim(), "Now pick your age and the kind of work.");
  type(p.window, d.getElementById("pKind"), "job");
  await tick();
  assert.equal(out(p).textContent.trim(), "Now pick your age.");
  assert.equal(d.getElementById("pStatus").textContent, "Pick your age.");
  p.window.close();
});

test("the share link holds the short-answer state, the age and the kind", async () => {
  const p = await lite(LITE_WITHOUT, "15", "job");
  await waitFor(() => p.window.location.search.includes("kind="));
  assert.equal(p.window.location.search, "?state=" + LITE_WITHOUT + "&age=15&kind=job");
  p.window.close();
});

test("the area and age saved on Programs pick the state and age; the address wins over them", async () => {
  const saved = { findprefs: { place: "city:atlanta", age: "15" } };
  const p = await open({ storage: saved });
  assert.equal(p.document.getElementById("pState").value, "ga");
  assert.equal(p.document.getElementById("pAge").value, "15");
  p.window.close();
  const q = await open({ storage: saved, search: "?state=ny&age=16" });
  assert.equal(q.document.getElementById("pState").value, "ny");
  assert.equal(q.document.getElementById("pAge").value, "16");
  q.window.close();
  const bad = await open({ storage: { findprefs: { place: "city:atlanta", age: "21" } } });
  assert.equal(bad.document.getElementById("pAge").value, "", "an age the page does not offer is ignored");
  bad.window.close();
});
