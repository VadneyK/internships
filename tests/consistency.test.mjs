// Cross-file consistency: the same fact in several files must agree.
// Run with: node --test tests/consistency.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));

const permits = json("data/permits.json");
const younger = json("data/younger.json");
const money = json("data/money.json");
const languages = json("data/languages.json");
const rules = read("src/rules.html");

const digits = (s) => String(s).replace(/\D/g, "");
const phonesIn = (s) => (String(s).match(/(?:1[-. ])?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/g) || []).map((m) => digits(m).slice(-10));

test("each phone in younger.json calls appears in the matching permits.json state call text", () => {
  for (const [state, text] of Object.entries(younger.calls)) {
    const wanted = phonesIn(text);
    assert.ok(wanted.length > 0, `younger.json calls.${state} has no phone number`);
    const permitCall = permits.states[state] && permits.states[state].call;
    assert.ok(permitCall, `permits.json has no call text for ${state}`);
    const have = phonesIn(permitCall);
    for (const ph of wanted) assert.ok(have.includes(ph), `${state}: ${ph} (younger.json) is not in permits.json call text "${permitCall}"`);
  }
});

test("the California Labor Commissioner phone is the same in every file", () => {
  const ph = phonesIn(permits.states.ca.call)[0];
  assert.equal(ph, "8335264636");
  assert.ok(phonesIn(younger.calls.ca).includes(ph), "younger.json");
  const moneyCalls = JSON.stringify(money);
  assert.ok(phonesIn(moneyCalls).includes(ph), "money.json");
  assert.ok(phonesIn(JSON.stringify(languages)).includes(ph), "languages.json");
  assert.ok(phonesIn(rules).includes(ph), "src/rules.html");
});

test("the California wage agrees in money.json, permits.json, languages.json and rules.html", () => {
  const preset = money.presets.find((p) => p.id === "ca");
  assert.ok(preset, "money.json has a ca preset");
  const dollars = (s) => (String(s).match(/\$(\d+\.\d\d)/g) || []).map((m) => Number(m.slice(1)));
  const fromPermits = dollars(permits.states.ca.wage)[0];
  assert.equal(preset.wage, fromPermits, "money.json preset vs permits.json ca.wage");
  assert.ok(dollars(preset.label).includes(preset.wage), "money.json preset label shows its own wage");
  const langEntries = collect(languages).filter((i) => i.state === "California" && /minimum wage/i.test(i.title));
  assert.ok(langEntries.length > 0, "languages.json has a California minimum wage entry");
  for (const e of langEntries) assert.ok(dollars(e.covers).includes(preset.wage), `languages.json: ${e.covers}`);
  const fmt = "$" + preset.wage.toFixed(2);
  assert.ok(rules.includes(fmt + " an hour in 2026"), "src/rules.html states the wage");
});

function collect(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (node && typeof node === "object") {
    if (node.state && node.title && node.covers) out.push(node);
    Object.values(node).forEach((n) => collect(n, out));
  }
  return out;
}

test("younger.json says Not stated for Volunteering and Babysitting only when permits.json has permit null", () => {
  const map = { Babysitting: "odd", Volunteering: "volunteer" };
  for (const [job, kind] of Object.entries(map)) {
    const row = younger.rows.find((r) => r.job === job);
    assert.ok(row, `younger.json has a ${job} row`);
    for (const [state, cell] of Object.entries(row.cells)) {
      if (!/not stated/i.test(cell.t)) continue;
      const k = permits.states[state] && permits.states[state].kinds[kind];
      assert.ok(k, `permits.json has ${state}.${kind}`);
      assert.equal(k.permit, null, `${job} / ${state} says Not stated in younger.json but permits.json ${state}.${kind} says permit=${k.permit}`);
    }
  }
});

test("California pet care is not listed as something 12 and 13 year olds can do, because younger.json says it is not named", () => {
  const row = younger.rows.find((r) => r.job === "Pet care");
  assert.ok(row, "younger.json has a Pet care row");
  assert.match(row.cells.ca.t, /not named/i);
  const claims = [
    ["src/rules.html", rules],
    ["rules.html", read("rules.html")],
    ["data/permits.json ca.minAge.note", permits.states.ca.minAge.note],
  ];
  for (const [where, text] of claims) {
    const clauses = text.match(/[^.]*\bcan do\b[^.]*/gi) || [];
    assert.ok(clauses.length > 0, `${where} has a 'can do' sentence for 12 and 13 year olds`);
    for (const clause of clauses) {
      assert.doesNotMatch(clause, /pet care/i, `${where}: "${clause.trim()}" lists pet care as something 12 and 13 year olds can do`);
    }
  }
});

test("if a younger.json Babysitting cell says 'at least 14', the federal text names New York", () => {
  const row = younger.rows.find((r) => r.job === "Babysitting");
  assert.ok(row, "younger.json has a Babysitting row");
  const cells = Object.entries(row.cells).filter(([, cell]) => cell.t.includes("at least 14"));
  assert.ok(cells.length > 0, "a Babysitting cell names the at least 14 rule");
  for (const [state] of cells) {
    assert.match(younger.federal, /New York/, `younger.json federal text must name New York because the ${state} Babysitting cell says "at least 14"`);
  }
});
