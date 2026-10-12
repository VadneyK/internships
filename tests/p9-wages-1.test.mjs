// Ticket p9-wages-1: the state minimum and any youth, training or first-90-days wage figure
// must agree between data/permits.json and data/state-wages.json for every state both files cover.
// Run with: node --test tests/p9-wages-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => JSON.parse(fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"));
const permits = read("data/permits.json");
const wages = read("data/state-wages.json");
const rowById = new Map(wages.states.map((r) => [r.id, r]));

// Dollar figures like $4.25, $17.00 or $405,000, as numbers.
const DOLLAR = /\$(\d[\d,]*(?:\.\d+)?)/g;
// A sentence is about a youth, training or first-90-days wage when it says one of these.
const YOUTH = /youth|minor|training|trainee|learner|opportunity wage|90[- ]day|first 90|under (?:1[0-9]|20)\b|workers? (?:aged )?1[0-9]\b|\b1[4-7] (?:and|to) 1[4-7]\b/i;

export function dollarsIn(text) {
  return [...String(text || "").matchAll(DOLLAR)].map((m) => Number(m[1].replace(/,/g, "")));
}

export function youthDollars(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => YOUTH.test(sentence))
    .flatMap(dollarsIn);
}

// Returns a list of problems for one state. An empty list means the two files agree.
// A youth figure only has to appear somewhere in the other file's wage text, so a figure that
// both files already state for the adult rate still counts as agreement.
export function wageProblems(id, permitsWage, swRow) {
  const problems = [];
  const swAll = [...dollarsIn(swRow.wage), ...dollarsIn(swRow.youth)];
  const pmAll = dollarsIn(permitsWage);
  const minimum = dollarsIn(swRow.wage)[0];
  if (minimum === undefined) problems.push(`${id}: state-wages wage text has no dollar figure`);
  else if (!pmAll.includes(minimum)) problems.push(`${id}: state minimum $${minimum} is not in permits.json wage text`);
  for (const f of youthDollars(permitsWage)) {
    if (!swAll.includes(f)) problems.push(`${id}: permits.json youth figure $${f} is not in state-wages.json`);
  }
  const swYouth = [...youthDollars(swRow.wage), ...youthDollars(swRow.youth)];
  for (const f of swYouth) {
    if (!pmAll.includes(f)) problems.push(`${id}: state-wages youth figure $${f} is not in permits.json wage text`);
  }
  return problems;
}

const overlap = Object.keys(permits.states).filter((id) => rowById.has(id));

test("the shared states are covered (at least 17 of them)", () => {
  assert.ok(overlap.length >= 17, `only ${overlap.length} shared states: ${overlap.join(", ")}`);
});

for (const id of overlap) {
  test(`${id}: state minimum and youth wage figures agree in both files`, () => {
    const pmWage = permits.states[id].wage || "";
    assert.deepEqual(wageProblems(id, pmWage, rowById.get(id)), []);
  });
}

test("negative control: a youth figure only in permits.json is reported", () => {
  const problems = wageProblems(
    "zz",
    "$10.00 an hour. Employers may pay workers under 20 $8.00 for the first 90 days.",
    { wage: "$10.00 an hour.", youth: "The page does not say whether a lower youth wage applies." },
  );
  assert.deepEqual(problems, ["zz: permits.json youth figure $8 is not in state-wages.json"]);
});

test("negative control: a state minimum missing from permits.json is reported", () => {
  const problems = wageProblems("zz", "$9.00 an hour.", { wage: "$10.00 an hour.", youth: "" });
  assert.deepEqual(problems, ["zz: state minimum $10 is not in permits.json wage text"]);
});

test("negative control: a youth figure only in state-wages.json is reported", () => {
  const problems = wageProblems("zz", "$10.00 an hour.", {
    wage: "$10.00 an hour.",
    youth: "Workers under 18 may be paid $9.00 an hour.",
  });
  assert.deepEqual(problems, ["zz: state-wages youth figure $9 is not in permits.json wage text"]);
});

test("negative control: matching figures give no problems", () => {
  const problems = wageProblems(
    "zz",
    "$10.00 an hour. Workers under 18 may be paid $9.00 an hour while they work less than 650 hours.",
    { wage: "$10.00 an hour.", youth: "Workers under 18 may be paid $9.00 an hour." },
  );
  assert.deepEqual(problems, []);
});
