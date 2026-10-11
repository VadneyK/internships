// Unsourced claims about what real employers do must not appear on the rules or parents pages (ticket r2-accuracy-2).
// Any match of the absolute phrases must name the FTC in the same statement, otherwise the test fails.
// Run with: node --test tests/r4-accuracy-2-employer-claims.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const PHRASES = ["never charge", "do not charge you", "will also know about work permits"];

function filesIn(dir, ext) {
  return fs
    .readdirSync(new URL(dir, root))
    .filter((f) => f.endsWith(ext))
    .map((f) => dir + f);
}

// Return the statement around a match: from the nearest sentence or tag boundary before it to the one after it.
function statementAround(text, index) {
  const before = text.slice(0, index).split(/[.<>"]/).pop() ?? "";
  const after = text.slice(index).split(/[.<>"]/)[0] ?? "";
  return before + after;
}

test("absolute employer-fee and work-permit claims name the FTC or are absent", () => {
  const targets = [...filesIn("src/", ".html"), ...filesIn("data/", ".json")];
  for (const file of targets) {
    const text = read(file);
    for (const phrase of PHRASES) {
      let index = text.indexOf(phrase);
      while (index !== -1) {
        const statement = statementAround(text, index);
        assert.ok(/FTC/.test(statement), `${file} has unsourced claim "${phrase}" in: ${statement.trim()}`);
        index = text.indexOf(phrase, index + phrase.length);
      }
    }
  }
});

test("rules page no longer says a real employer knows about work permits", () => {
  for (const file of ["src/rules.html", "rules.html"]) {
    const text = read(file);
    assert.ok(!text.includes("will also know about work permits"), `${file} still has the employer claim`);
    assert.ok(
      text.includes("Ask the school work permit office if a job says you do not need a permit."),
      `${file} is missing the school work permit office line`
    );
  }
});

test("parents.json cost line matches the rules page red-flag wording", () => {
  const rows = JSON.parse(read("data/parents.json")).safe.scams;
  const cost = rows.find((s) => s.t.startsWith("Does it cost anything?"));
  assert.ok(cost, "parents.json has the cost statement");
  assert.equal(
    cost.t,
    "Does it cost anything? Fees, starter kits, training, certifications and refundable deposits are warning signs. A job that asks you to pay is a red flag. Show a parent before you pay anything."
  );
  assert.equal(cost.p, "rules.html#scams");
  assert.ok(!/Real employers and the government/.test(cost.t), "parents.json still makes the employer and government claim");
});
