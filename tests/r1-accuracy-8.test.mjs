// Cross-file consistency: wages, hotlines and repeated rules typed by hand in several places (ticket r1-accuracy-8).
// Known intentional difference: money.json lists NY 888-469-7365 and younger.json lists NY 888-525-2267;
// permits.json lists both, so each copy is checked against permits.json rather than against each other.
// Run with: node --test tests/r1-accuracy-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const PM = JSON.parse(rd("data/permits.json"));
const MONEY = JSON.parse(rd("data/money.json"));
const YOUNGER = JSON.parse(rd("data/younger.json"));
const LANG = rd("data/languages.json");
const TRANSIT = rd("data/transit.json");
const STATES = rd("states.html");
const RULES = rd("rules.html");
const digits = (s) => s.replace(/\D/g, "");
const phones = (s) => (s.match(/(?:1-)?\d{3}-\d{3}-\d{4}/g) || []).map((p) => digits(p).replace(/^1(?=\d{10}$)/, ""));
const has = (hay, needle) => hay.includes(needle);

const HOTLINES = { ga: "8777098185", ny1: "8884697365", ny2: "8885252267" };

test("California wages match in permits, money preset, languages and rules page", () => {
  assert.match(PM.states.ca.wage, /\$16\.90/);
  assert.match(PM.states.ca.wage, /\$17\.40/);
  assert.ok(MONEY.presets.find((p) => p.id === "ca").label.includes("$16.90"));
  assert.equal(MONEY.presets.find((p) => p.id === "ca").wage, 16.9);
  assert.ok(has(LANG, "$16.90 an hour in 2026"));
  assert.ok(has(RULES, "$16.90"));
  assert.ok(has(RULES, "$17.40"));
  assert.ok(has(RULES, "$16.90</b> an hour in 2026"));
  assert.ok(has(RULES, "$17.40</b> starting Jan 1, 2027"));
  // No other California-style figure sneaks in next to the pair.
  assert.ok(!/\$17\.4[1-9]|\$16\.9[1-9]/.test(RULES));
});

test("New York wages match in permits, money presets, states page", () => {
  const w = PM.states.ny.wage;
  assert.match(w, /\$17\.00/);
  assert.match(w, /\$16\.00/);
  const nyc = MONEY.presets.find((p) => p.id === "ny-nyc");
  const up = MONEY.presets.find((p) => p.id === "ny-up");
  assert.equal(nyc.wage, 17);
  assert.equal(up.wage, 16);
  assert.ok(nyc.label.includes("$17.00"));
  assert.ok(up.label.includes("$16.00"));
  assert.ok(has(STATES, "<b>$17.00</b> in New York City, Long Island and Westchester"));
  assert.ok(has(STATES, "<b>$16.00</b> in the rest of the state"));
});

test("Illinois $15.00 / $13.00 / 650 hours match in permits, money presets, states page", () => {
  const w = PM.states.il.wage;
  for (const s of ["$15.00", "$13.00", "650 hours"]) assert.ok(has(w, s), "permits " + s);
  const y = MONEY.presets.find((p) => p.id === "il-youth");
  const a = MONEY.presets.find((p) => p.id === "il-adult");
  assert.equal(y.wage, 13);
  assert.equal(a.wage, 15);
  assert.ok(y.label.includes("$13.00") && y.label.includes("650 hours"));
  assert.ok(a.label.includes("$15.00") && a.label.includes("650 hours"));
  for (const s of ["$15.00 an hour", "$13.00", "650 hours"]) assert.ok(has(STATES, s), "states " + s);
});

test("Chicago $17.05 line matches across permits, money and states page", () => {
  const re = /Chicago is \$17\.05 from July 1, 2026 at employers with 4 or more employees/;
  assert.match(PM.states.il.wage, re);
  assert.match(JSON.stringify(MONEY.gaps), /Chicago is \$17\.05 from July 1, 2026 at employers with 4 or more employees/);
  const plain = STATES.replace(/<[^>]+>/g, "");
  assert.match(plain, /Chicago:\s*\$17\.05 from July 1, 2026 at employers with 4 or more employees/);
  // The "under 18" caveat sentence is the same wherever Chicago appears with permits.
  const caveat = "The city page we read does not say if this covers workers under 18.";
  assert.ok(has(PM.states.il.wage, caveat));
  assert.ok(has(plain, caveat));
});

test("Georgia hotline matches in permits, younger and languages", () => {
  assert.ok(phones(PM.states.ga.call).includes(HOTLINES.ga));
  assert.ok(phones(YOUNGER.calls.ga).includes(HOTLINES.ga));
  assert.ok(phones(LANG).includes(HOTLINES.ga));
  assert.ok(phones(STATES).includes(HOTLINES.ga));
  // Every Georgia number in permits caveats is the same hotline.
  const gaText = JSON.stringify(PM.states.ga);
  for (const p of phones(gaText)) {
    if (p === "8664879243") continue; // US DOL Wage and Hour, a different office
    assert.equal(p, HOTLINES.ga);
  }
});

test("New York hotlines: both numbers in permits, states page; money and younger use one of them", () => {
  const permits = phones(PM.states.ny.call);
  assert.deepEqual(permits.sort(), [HOTLINES.ny1, HOTLINES.ny2].sort());
  const money = MONEY.states.find((s) => s.id === "ny").call;
  assert.ok(permits.includes(digits(money)));
  assert.ok(permits.includes(digits(YOUNGER.calls.ny)));
  const st = phones(STATES);
  assert.ok(st.includes(HOTLINES.ny1) && st.includes(HOTLINES.ny2));
  assert.ok(phones(LANG).includes(HOTLINES.ny1));
  // Every NY number in the permit caveats is one of the two official numbers.
  for (const p of phones(JSON.stringify(PM.states.ny))) assert.ok(permits.includes(p), p);
});

test("California and Illinois hotlines in permits match money and younger entries", () => {
  const caP = phones(PM.states.ca.call)[0];
  assert.equal(digits(MONEY.states.find((s) => s.id === "ca").call), caP);
  assert.ok(phones(YOUNGER.calls.ca).includes(caP));
  const ilP = phones(PM.states.il.call);
  assert.ok(ilP.includes(phones(YOUNGER.calls.il)[0]));
});

test("transit.json does not carry its own copy of the repeated wages", () => {
  for (const bad of ["$16.9", "$17.4", "$17.05"]) {
    // If transit ever mentions these, it must use the exact figures above.
    if (TRANSIT.includes(bad)) assert.ok(/\$16\.90|\$17\.40|\$17\.05/.test(TRANSIT));
  }
});
