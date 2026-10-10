// Page text names every language that has a row in data/languages.json, and the
// younger page note matches the layout it describes (ticket r3-accuracy-6).
// Run with: node --test tests/r3-accuracy-6.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const data = JSON.parse(read("data/languages.json"));

// Labels look like "Espanol (Spanish)" or "Tagalog". The English name is in the last parentheses, or the whole label.
const englishName = (label) => {
  const m = label.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : label.trim();
};

const names = new Map(data.languages.map(([code, label]) => [code, englishName(label)]));
const codesWithRows = [...new Set(data.rows.flatMap((r) => r.lang))];
const namesWithRows = codesWithRows.map((code) => {
  assert.ok(names.has(code), `row uses language code "${code}" that is not in the languages array`);
  return names.get(code);
});

test("every language with a row has a name in the languages array", () => {
  assert.ok(namesWithRows.length > 0, "no language has a row");
  for (const name of namesWithRows) assert.ok(name && name.length > 0);
});

test("languages.html desc names every language that has a row", () => {
  const desc = read("src/languages.html").match(/^desc:\s*(.*)$/m);
  assert.ok(desc, "src/languages.html has no desc line");
  const missing = namesWithRows.filter((name) => !desc[1].includes(name));
  assert.deepEqual(missing, [], "src/languages.html desc is missing these languages");
});

test("ready.html names every language that has a row", () => {
  const sentence = read("src/ready.html").match(/Official pages in ([^<]+)</);
  assert.ok(sentence, "src/ready.html has no 'Official pages in' sentence");
  const missing = namesWithRows.filter((name) => !sentence[1].includes(name));
  assert.deepEqual(missing, [], "src/ready.html sentence is missing these languages");
});

test("built root pages carry the same language text", () => {
  const rootReady = read("ready.html");
  const rootLanguages = read("languages.html");
  for (const name of namesWithRows) {
    assert.ok(rootReady.includes(name), `ready.html is missing ${name}`);
    assert.ok(rootLanguages.includes(name), `languages.html is missing ${name}`);
  }
});

test("younger.html no longer describes a blank cell", () => {
  assert.doesNotMatch(read("src/younger.html"), /blank cell/i);
  assert.doesNotMatch(read("younger.html"), /blank cell/i);
});

test("younger.html explains the Not stated cell", () => {
  assert.match(
    read("src/younger.html"),
    /A cell that says Not stated means the state page we read does not say\. It does not mean allowed, and it does not mean banned\./,
  );
});

test("contribute.html does not list Ukrainian as a page language", () => {
  // Ukrainian is a volunteer request only, so the contribute page is left alone.
  assert.ok(!read("src/contribute.html").includes("Ukrainian pages"));
});
