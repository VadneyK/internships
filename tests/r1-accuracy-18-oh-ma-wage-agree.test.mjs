// A permit card must not say the minimum wage could not be confirmed or read when state-wages.json
// already gives a dollar figure for that state. Ohio and Massachusetts had this problem (ticket r1-accuracy-18).
// Run with: node --test tests/r1-accuracy-18-oh-ma-wage-agree.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const permits = JSON.parse(rd("data/permits.json"));
const wages = JSON.parse(rd("data/state-wages.json"));
const UNKNOWN = /could not confirm|could not read/i;
const DOLLAR = /\$\d/;

const wageRows = new Map(wages.states.map((s) => [s.id, s]));

test("Ohio permit wage gives the state figure and no unknown wording", () => {
  const text = permits.states.oh.wage;
  assert.ok(text.includes("$11.00 an hour at employers with $405,000 or more in yearly gross receipts"), "oh.wage lacks the $11.00 figure");
  assert.ok(text.includes("$7.25 at smaller employers"), "oh.wage lacks the $7.25 figure");
  assert.ok(text.includes("US Department of Labor state table, updated July 1, 2026"), "oh.wage lacks the DOL table source");
  assert.ok(text.includes("Under 16, the employer must pay at least the federal $7.25."), "oh.wage lacks the under-16 sentence");
  assert.ok(!UNKNOWN.test(text), "oh.wage still says the rate could not be confirmed");
});

test("Massachusetts permit wage gives the state figure and the source", () => {
  const text = permits.states.ma.wage;
  assert.ok(text.includes("At least $15.00 an hour under state law"), "ma.wage lacks the $15.00 figure");
  assert.ok(text.includes("General Laws chapter 151, section 1"), "ma.wage lacks the statute");
});

test("no permit wage says could not confirm or could not read when state-wages.json has a dollar figure", () => {
  const offenders = [];
  for (const [id, card] of Object.entries(permits.states)) {
    if (!card.wage || !UNKNOWN.test(card.wage)) continue;
    const row = wageRows.get(id);
    const hasFigure = Boolean(row && DOLLAR.test(row.wage || ""));
    if (hasFigure) offenders.push(`${id}: ${card.wage}`);
  }
  assert.deepEqual(offenders, [], `permits.json wage says unknown while state-wages.json has a figure: ${offenders.join(" | ")}`);
});
