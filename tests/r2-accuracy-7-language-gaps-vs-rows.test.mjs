// Gap notes in data/languages.json name every language that has no card in a state (ticket r2-accuracy-7).
// Run with: node --test tests/r2-accuracy-7-language-gaps-vs-rows.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../data/languages.json", import.meta.url), "utf8"));

// Labels look like "Espanol (Spanish)" or "Tagalog". The English name is in the last parentheses, or the whole label.
const englishName = (label) => {
  const m = label.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : label.trim();
};
const names = new Map(data.languages.map(([code, label]) => [code, englishName(label)]));

const gapFor = (state) => {
  const found = data.gaps.find((g) => g.startsWith(`${state}:`));
  assert.ok(found, `no gap note starts with "${state}:"`);
  return found;
};

test("New York gap names every listed language that has no child labor card", () => {
  const cards = data.rows.filter((r) => r.state === "New York" && r.title.includes("Child labor card"));
  assert.ok(cards.length > 0, "no New York child labor card rows");
  const covered = new Set(cards.flatMap((r) => r.lang));
  const missing = data.languages
    .map(([code]) => code)
    .filter((code) => !covered.has(code))
    .map((code) => names.get(code));
  assert.ok(missing.length > 0, "expected at least one listed language without a New York card");
  const gap = gapFor("New York");
  const absent = missing.filter((name) => !gap.includes(name));
  assert.deepEqual(absent, [], "New York gap text is missing these languages");
});

test("New York gap names Ukrainian, since its only row is the phone help line", () => {
  assert.ok(gapFor("New York").includes("Ukrainian"));
});

test("Georgia gap names Spanish only when Georgia rows hold only es", () => {
  const georgia = data.rows.filter((r) => r.state === "Georgia");
  assert.ok(georgia.length > 0, "no Georgia rows");
  const onlySpanish = georgia.every((r) => r.lang.length === 1 && r.lang[0] === "es");
  if (onlySpanish) assert.ok(gapFor("Georgia").includes("Spanish"));
});
