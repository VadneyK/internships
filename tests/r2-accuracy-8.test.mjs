// Chicago youth pay is stated the same way everywhere, and the Illinois estimate says it is for outside Chicago (ticket r2-accuracy-8).
// Run with: node --test tests/r2-accuracy-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const states = read("src/states.html");
const permits = JSON.parse(read("data/permits.json"));
const money = JSON.parse(read("data/money.json"));

const ilWage = permits.states.il.wage;
const chicagoClause = (text) => {
  const m = text.match(/Chicago is \$17\.05[^.]*\./);
  return m ? m[0] : "";
};

test("the Chicago $17.05 figure agrees between states.html and permits.json", () => {
  const stateMatch = states.match(/<b>Chicago:<\/b> <b>(\$[\d.]+)<\/b>/);
  assert.ok(stateMatch, "states.html has a Chicago rate");
  assert.equal(stateMatch[1], "$17.05");
  assert.ok(ilWage.includes("Chicago is $17.05"), "permits il.wage has the Chicago rate");
  assert.match(chicagoClause(ilWage), /at employers with 4 or more employees/, "permits il.wage keeps the 4 or more employees condition");
  assert.match(states, /\$17\.05<\/b> from July 1, 2026 at employers with 4 or more employees/, "states.html keeps the same condition");
});

test("the Chicago rate in permits.json does not claim a youth same rate the city page does not state", () => {
  assert.doesNotMatch(ilWage, /the city says youth workers get the same rate/);
  assert.match(ilWage, /does not say if this covers workers under 18/);
});

test("both Illinois money presets say they are for outside Chicago and keep their wage in the label", () => {
  const il = money.presets.filter((p) => p.state === "il");
  assert.deepEqual(il.map((p) => p.id), ["il-youth", "il-adult"]);
  for (const p of il) {
    assert.ok(p.label.startsWith("Illinois outside Chicago, "), p.id + ": " + p.label);
    assert.ok(p.label.includes("outside Chicago"), p.id);
    assert.ok(p.label.includes(`($${p.wage.toFixed(2)})`), p.id + " label has its wage");
  }
});

test("the money gaps line names Chicago's $17.05 rate and says the estimate does not use it", () => {
  const gap = money.gaps.find((g) => g.startsWith("Other city minimum wages and city taxes."));
  assert.ok(gap, "gaps has the city minimum wage line");
  assert.ok(gap.includes("Chicago is $17.05 from July 1, 2026 at employers with 4 or more employees"));
  assert.ok(gap.includes("this estimate does not use it"));
  assert.ok(!money.gaps.some((g) => g.includes("such as Chicago's higher minimum")), "old gap line is gone");
});
