// Youth wage wording in permits.json must match state-wages.json (ticket r1-accuracy-3).
// Run with: node --test tests/r1-accuracy-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const permits = JSON.parse(read("data/permits.json")).states;
const wages = JSON.parse(read("data/state-wages.json")).states;
const rules = read("src/rules.html");
const statesPage = read("src/states.html");

const figures = (text) => [
  ...[...text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)].map((m) => `$${Number(m[1].replace(/,/g, ""))}`),
  ...[...text.matchAll(/(\d+(?:\.\d+)?)\s?(?:%|percent)/gi)].map((m) => `${Number(m[1])} percent`),
];
const permitFigures = (text) => new Set(figures(text));
const NO_ANSWER = "does not say whether a lower youth wage applies";

test("every youth rate figure in state-wages.json appears in the permits wage text", () => {
  let checked = 0;
  for (const w of wages) {
    const p = permits[w.id];
    if (!p) continue;
    const have = permitFigures(p.wage);
    for (const f of figures(w.youth)) {
      checked++;
      assert.ok(have.has(f), `${w.id}: permits wage is missing ${f} from state-wages youth`);
    }
  }
  assert.ok(checked > 5, "the check looked at real figures");
});

test("no permits wage says there is no lower rate when state-wages says the page does not say", () => {
  for (const w of wages) {
    const p = permits[w.id];
    if (!p || !w.youth.includes("does not say")) continue;
    assert.ok(!/no lower rate/i.test(p.wage), `${w.id}: permits wage says no lower rate`);
  }
  assert.ok(!/no lower rate/i.test(statesPage), "states.html does not say no lower rate");
});

test("Michigan and New York use the does-not-say wording", () => {
  for (const id of ["mi", "ny"]) assert.ok(permits[id].wage.includes(NO_ANSWER), id);
  assert.ok(statesPage.includes(NO_ANSWER), "states.html NY pay text");
});

test("rules.html names the California learner exception, not a flat same-as-adults claim", () => {
  const plain = rules.replace(/\s+/g, " ");
  assert.ok(!/teens get the same (minimum wage )?as adults\./i.test(plain), "no flat claim");
  const n = plain.split("Learners of any age with no related experience may be paid 85 percent for their first 160 hours").length - 1;
  assert.equal(n, 2);
});

test("Minnesota, Virginia and Wisconsin training wage scopes are on the cards", () => {
  assert.match(permits.mn.wage, /\$9\.31/);
  assert.match(permits.mn.wage, /under 20/);
  assert.match(permits.va.wage, /75 percent/);
  assert.match(permits.va.wage, /90 days/);
  assert.match(permits.wi.wage, /under 20/);
});
