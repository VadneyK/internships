// Age fields sanity and the ageOk boundary rules in assets/js/lib.js.
// Run with: node --test tests/r1-tests-3-age-fields.test.mjs
// Every program file must have min_age and max_age that are null or whole numbers from 8 to 30, with min_age <= max_age when both are set.
// Ten programs state a youngest age of 5 to 7 (4-H and similar youth programs). They are listed by file name below with their exact values,
// so any change to them fails this test and forces a review. Files are read from disk, so no clock or network is used.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROGRAM_DIR = path.join(ROOT, "data", "programs");

// Known exceptions to the 8 to 30 range, keyed by file name, with the exact values each file states.
const KNOWN_YOUNG_MIN = {
  "black-girls-code.json": 7,
  "boys-girls-clubs-metro-atlanta.json": 6,
  "charlottesville-bgcca-teen-clubs.json": 5,
  "lafayette-parks-workreation.json": 7,
  "massachusetts-4h-youth-development.json": 5,
  "new-york-state-4h-youth-development.json": 5,
  "pennsylvania-4h-youth-development.json": 5,
  "sf-826-valencia.json": 6,
  "va-4-h-youth-development.json": 5,
  "washington-4h.json": 5,
};

// Every program file, read once, with its file name.
const PROGRAMS = fs
  .readdirSync(PROGRAM_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({ file: f, entry: JSON.parse(fs.readFileSync(path.join(PROGRAM_DIR, f), "utf8")) }));

// Small seeded PRNG (mulberry32), so the 300 sampled entries are the same on every run.
function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isAgeValue(v) {
  return v === null || (Number.isInteger(v) && v >= 8 && v <= 30);
}

test("every program has min_age and max_age that are null or whole numbers from 8 to 30", () => {
  const problems = [];
  for (const { file, entry } of PROGRAMS) {
    for (const key of ["min_age", "max_age"]) {
      const v = entry[key] === undefined ? null : entry[key];
      if (isAgeValue(v)) continue;
      if (key === "min_age" && Object.prototype.hasOwnProperty.call(KNOWN_YOUNG_MIN, file) && v === KNOWN_YOUNG_MIN[file]) continue;
      problems.push(file + " " + key + " = " + JSON.stringify(v));
    }
  }
  assert.deepEqual(problems, []);
});

test("the known youth-program exceptions still match their files exactly", () => {
  const byFile = new Map(PROGRAMS.map((p) => [p.file, p.entry]));
  for (const [file, value] of Object.entries(KNOWN_YOUNG_MIN)) {
    assert.ok(byFile.has(file), "missing file " + file);
    assert.equal(byFile.get(file).min_age, value, file);
  }
});

test("min_age is never above max_age when both are set", () => {
  const bad = PROGRAMS.filter(({ entry }) => entry.min_age != null && entry.max_age != null && entry.min_age > entry.max_age).map((p) => p.file);
  assert.deepEqual(bad, []);
});

test("ageOk boundaries hold for a seeded sample of 300 entries", () => {
  const rand = seededRandom(20261010);
  const pool = PROGRAMS.map((p) => p.entry);
  const indexes = pool.map((_, i) => i);
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  const picked = indexes.slice(0, Math.min(300, indexes.length)).map((i) => pool[i]);
  assert.equal(picked.length, 300);

  for (const e of picked) {
    if (e.min_age != null) {
      assert.equal(L.ageOk(e, e.min_age), true, "min_age accepted " + e.min_age);
      assert.equal(L.ageOk(e, e.min_age - 1), false, "min_age - 1 rejected " + e.min_age);
    }
    if (e.max_age != null) {
      assert.equal(L.ageOk(e, e.max_age), true, "max_age accepted " + e.max_age);
      assert.equal(L.ageOk(e, e.max_age + 1), false, "max_age + 1 rejected " + e.max_age);
    }
    if (e.min_age == null && e.max_age == null) {
      for (let a = 10; a <= 20; a++) assert.equal(L.ageOk(e, a), true, "open entry accepts " + a);
    }
  }
});

test("entries with neither min_age nor max_age accept every age from 10 to 20", () => {
  const open = PROGRAMS.filter(({ entry }) => entry.min_age == null && entry.max_age == null);
  assert.ok(open.length > 0, "expected some open entries");
  for (const { file, entry } of open) {
    for (let a = 10; a <= 20; a++) {
      assert.equal(L.ageOk(entry, a), true, file + " should accept " + a);
    }
  }
});

test("ageOk never throws on odd input and returns a boolean", () => {
  const sample = { min_age: 12, max_age: 16 };
  const oddInputs = [undefined, null, 0, NaN, "15", "", "abc", -3];
  for (const age of oddInputs) {
    assert.doesNotThrow(() => L.ageOk(sample, age), "input " + String(age));
    assert.equal(typeof L.ageOk(sample, age), "boolean", "input " + String(age));
  }
  // Falsy ages (undefined, null, 0, NaN, "") mean "no age given", so the check passes.
  for (const age of [undefined, null, 0, NaN, ""]) {
    assert.equal(L.ageOk(sample, age), true, "falsy age " + String(age));
  }
  // A numeric string is read as a number.
  assert.equal(L.ageOk(sample, "15"), true);
  assert.equal(L.ageOk(sample, "11"), false);
  assert.equal(L.ageOk(sample, "17"), false);
});
