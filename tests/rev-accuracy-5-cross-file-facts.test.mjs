// Cross-file check: facts typed by hand in several places must agree.
// Reads the data files and source pages directly. No browser needed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const json = (f) => JSON.parse(read(f));

const permits = json("data/permits.json");
const money = json("data/money.json");
const younger = json("data/younger.json");
const languages = read("data/languages.json");
const rules = read("src/rules.html");
const states = read("src/states.html");

const dollars = (n) => "$" + Number(n).toFixed(2);
const digits = (s) => s.replace(/\D/g, "");
const phones = (s) => (s.match(/\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/g) || []).map(digits);

test("(a) every money.json preset wage appears in that state's permits wage text", () => {
  assert.ok(money.presets.length > 0);
  for (const p of money.presets) {
    const wage = permits.states[p.state]?.wage;
    assert.ok(wage, `permits.json has no wage text for ${p.state}`);
    assert.ok(wage.includes(dollars(p.wage)), `${p.id}: ${dollars(p.wage)} not in permits ${p.state} wage: ${wage}`);
  }
  const want = { ca: [16.9], ga: [7.25], ny: [17, 16], il: [13, 15] };
  for (const [st, list] of Object.entries(want)) {
    for (const w of list) {
      assert.ok(money.presets.some((p) => p.state === st && p.wage === w), `money.json is missing preset ${st} ${w}`);
    }
  }
});

test("(b) California $16.90 and $17.40 agree in permits, languages and rules", () => {
  for (const amt of ["$16.90", "$17.40"]) {
    assert.ok(permits.states.ca.wage.includes(amt), `permits ca wage lacks ${amt}`);
    // The Spanish DIR page shows only the 2026 rate (ticket r1-accuracy-14), so languages.json carries $16.90 only.
    if (amt === "$16.90") assert.ok(languages.includes(amt.slice(1)), `languages.json lacks ${amt}`);
    assert.ok(rules.includes(amt), `rules.html lacks ${amt}`);
  }
});

test("(c) younger.json phone numbers appear in the same state's permits call field", () => {
  for (const st of ["ca", "ga", "ny", "il"]) {
    const mine = phones(younger.calls[st]);
    assert.ok(mine.length > 0, `no phone number found in younger.json calls ${st}`);
    const theirs = phones(permits.states[st].call);
    for (const n of mine) assert.ok(theirs.includes(n) || theirs.some((t) => t.endsWith(n)), `${st}: ${n} not in permits call: ${permits.states[st].call}`);
  }
});

test("(d) $4.25 goes with 90 days in every permits wage text and the Georgia section of states.html", () => {
  const withIt = Object.entries(permits.states).filter(([, v]) => v.wage.includes("$4.25"));
  assert.ok(withIt.length >= 5, "expected GA, TX, IN, NC and PA to mention $4.25");
  for (const [st, v] of withIt) assert.match(v.wage, /\b90\b/, `${st} wage mentions $4.25 without 90`);
  const m = states.match(/<section id="georgia">([\s\S]*?)<\/section>/);
  assert.ok(m, "Georgia section not found in states.html");
  assert.ok(m[1].includes("$4.25") && /\b90\b/.test(m[1]), "Georgia section lacks $4.25 with 90");
});

test("(e) Illinois 650 hours and $13.00 agree in permits and states.html", () => {
  const il = permits.states.il.wage;
  assert.ok(il.includes("650") && il.includes("$13.00"), "permits il wage lacks 650 or $13.00");
  assert.match(states, /\$13\.00[^<]*650 hours/, "states.html lacks $13.00 with 650 hours");
});
