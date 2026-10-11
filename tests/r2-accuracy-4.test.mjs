// Illinois pay preset labels in money.json (ticket r2-accuracy-4).
// The adult label must not say "outside Chicago" for the state rate, because the Cook County
// ordinance sets $15.40 for 18 and older outside Chicago. The youth label must keep "with one employer".
// Run with: node --test tests/r2-accuracy-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const MONEY = JSON.parse(rd("data/money.json"));
const PERMITS = JSON.parse(rd("data/permits.json"));

const preset = (id) => MONEY.presets.find((p) => p.id === id);

test("il-adult label states the state rate and the Cook County $15.40 rule", () => {
  assert.equal(
    preset("il-adult").label,
    "Illinois, state rate ($15.00), after 650 hours or 18 and older. Cook County outside Chicago is $15.40 for 18 and older",
  );
});

test("il-youth label keeps 'first 650 hours in a year with one employer' from permits.json", () => {
  assert.ok(
    PERMITS.states.il.wage.includes("first 650 hours in a year with one employer"),
    "permits.json il.wage no longer has the one-employer rule",
  );
  assert.ok(
    preset("il-youth").label.includes("first 650 hours in a year with one employer"),
    preset("il-youth").label,
  );
});

test("Illinois labels use only numbers already in money.json gaps or permits.json", () => {
  const gaps = JSON.stringify(MONEY.gaps || []);
  const permits = JSON.stringify(PERMITS.states.il);
  const allowed = new Set(["$13.00", "$15.00", "$15.40", "650", "18"]);
  for (const id of ["il-adult", "il-youth"]) {
    const nums = preset(id).label.match(/\$?\d+(?:\.\d+)?/g) || [];
    for (const n of nums) {
      assert.ok(allowed.has(n), `${id} label has unexpected number ${n}`);
      const bare = n.replace(/^\$/, "");
      assert.ok(
        gaps.includes(bare) || permits.includes(bare),
        `${id} label number ${n} is not in money.json gaps or permits.json`,
      );
    }
  }
});

test("Illinois labels contain no dash characters", () => {
  for (const id of ["il-adult", "il-youth"]) {
    assert.doesNotMatch(preset(id).label, /[\u2012\u2013\u2014]/);
  }
});
