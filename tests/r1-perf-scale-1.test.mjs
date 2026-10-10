// Ticket r1-perf-scale-1: size budget for the data files, the root pages, the scripts and the stylesheet.
// A teen on a slow phone pays for every byte, so a change that bloats a file fails here with the file name, its size and its limit.
// Run with: node --test tests/r1-perf-scale-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Limits in bytes, about 10 percent above the sizes measured on 2026-10-10. Raised the same day for the city data wave: the guide grew from 1,187 to 1,370 programs (about 15 percent), so the four data limits grew by the same share. To raise one on purpose, change its number here in the same pull request and say why in that PR.
const LIMITS = {
  data: {
    "data/entries.json": { raw: 3050000, gzip: 700000 },
    "data/entries-lite.json": { raw: 1730000, gzip: 380000 },
    "data/entries-card.json": { raw: 870000, gzip: 126000 },
    "data/entries-core.json": { raw: 270000, gzip: 27000 },
  },
  liteBytesPerProgram: 1300,
  rootPage: 32000,
  // Raised from 40000 to 46000 on 2026-10-10: lib.js grew to 41715 bytes for the live chip counts, empty-state options, top picks and the cost-tier sort. Gzipped it is about 11 KB. The other scripts are all under 40000.
  script: 46000,
  stylesheet: 34000,
};

const LITE = "data/entries-lite.json";
const STYLESHEET = "assets/css/style.css";

// Measure one file: raw bytes, and gzipped bytes at zlib level 9.
function sizeOf(buf) {
  return { bytes: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length };
}

// Read every budgeted file from disk. Keys are repo-relative paths with forward slashes.
function measureRepo() {
  const sizes = {};
  for (const rel of Object.keys(LIMITS.data)) {
    sizes[rel] = sizeOf(fs.readFileSync(path.join(ROOT, rel)));
  }
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
  for (const page of pages) sizes[page] = sizeOf(fs.readFileSync(path.join(ROOT, page)));
  const scripts = fs.readdirSync(path.join(ROOT, "assets/js")).filter((f) => f.endsWith(".js")).sort();
  for (const script of scripts) {
    const rel = `assets/js/${script}`;
    sizes[rel] = sizeOf(fs.readFileSync(path.join(ROOT, rel)));
  }
  sizes[STYLESHEET] = sizeOf(fs.readFileSync(path.join(ROOT, STYLESHEET)));
  return sizes;
}

// Returns one message for each limit that a file breaks. Each message names the file, its size and the limit.
// sizes maps a repo-relative path to { bytes, gzip }. programCount is the "count" in data/meta.json.
export function budgetProblems(sizes, programCount) {
  const problems = [];
  for (const [file, size] of Object.entries(sizes)) {
    const data = LIMITS.data[file];
    if (data) {
      if (size.bytes > data.raw) {
        problems.push(`${file} is ${size.bytes} bytes, over the limit of ${data.raw} bytes`);
      }
      if (size.gzip > data.gzip) {
        problems.push(`${file} is ${size.gzip} bytes gzipped (level 9), over the limit of ${data.gzip} bytes gzipped`);
      }
      if (file === LITE && programCount > 0) {
        const perProgram = size.bytes / programCount;
        if (perProgram > LIMITS.liteBytesPerProgram) {
          problems.push(
            `${file} is ${Math.round(perProgram)} bytes per program (${size.bytes} bytes for ${programCount} programs), over the limit of ${LIMITS.liteBytesPerProgram} bytes per program`
          );
        }
      }
    } else if (!file.includes("/") && file.endsWith(".html")) {
      if (size.bytes > LIMITS.rootPage) {
        problems.push(`${file} is ${size.bytes} bytes, over the limit of ${LIMITS.rootPage} bytes for a root page`);
      }
    } else if (file.startsWith("assets/js/") && file.endsWith(".js")) {
      if (size.bytes > LIMITS.script) {
        problems.push(`${file} is ${size.bytes} bytes, over the limit of ${LIMITS.script} bytes for a script`);
      }
    } else if (file === STYLESHEET) {
      if (size.bytes > LIMITS.stylesheet) {
        problems.push(`${file} is ${size.bytes} bytes, over the limit of ${LIMITS.stylesheet} bytes for the stylesheet`);
      }
    }
  }
  return problems;
}

const programCount = JSON.parse(fs.readFileSync(path.join(ROOT, "data/meta.json"), "utf8")).count;
const repoSizes = measureRepo();

test("data/meta.json gives a program count to divide by", () => {
  assert.ok(Number.isInteger(programCount) && programCount > 0, `count in data/meta.json is ${programCount}`);
});

for (const file of Object.keys(repoSizes)) {
  test(`${file} is within its size budget`, () => {
    const problems = budgetProblems({ [file]: repoSizes[file] }, programCount);
    assert.deepEqual(problems, [], problems.join("\n"));
  });
}

test("the whole repo is within budget", () => {
  const problems = budgetProblems(repoSizes, programCount);
  assert.deepEqual(problems, [], problems.join("\n"));
});

// Mutation test: a fake size table with entries-lite.json at 1,800,000 raw bytes must be reported.
// The raw limit (1,730,000) is broken, and so is the per-program limit, because 1,800,000 / 1,370 is about 1,314 bytes per program (limit 1,300).
// Every other file in the fake table is inside its limit, so no other file may be reported.
test("mutation: a lite file at 1,800,000 bytes is reported, and only lite is reported", () => {
  const fake = { ...repoSizes, [LITE]: { bytes: 1800000, gzip: repoSizes[LITE].gzip } };
  const problems = budgetProblems(fake, programCount);
  assert.deepEqual(problems, [
    `${LITE} is 1800000 bytes, over the limit of 1730000 bytes`,
    `${LITE} is ${Math.round(1800000 / programCount)} bytes per program (1800000 bytes for ${programCount} programs), over the limit of 1300 bytes per program`,
  ]);
});

// Mutation test for a page: one root page one byte over its limit is the only problem reported.
test("mutation: a root page at 32,001 bytes is the only problem reported", () => {
  const fake = { ...repoSizes, "rules.html": { bytes: 32001, gzip: 9000 } };
  assert.deepEqual(budgetProblems(fake, programCount), [
    "rules.html is 32001 bytes, over the limit of 32000 bytes for a root page",
  ]);
});
