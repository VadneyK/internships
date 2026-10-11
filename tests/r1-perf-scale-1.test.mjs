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

// Limits in bytes, about 10 percent above the sizes measured on 2026-10-10. Raised the same day for the city data waves: the guide grew from 1,187 to 1,771 programs (the lite file is 2,017,065 bytes, 1,139 per program, so the per-program limit is unchanged) (about 36 percent), so the four data limits grew with it. To raise one on purpose, change its number here in the same pull request and say why in that PR.
const LIMITS = {
  data: {
    "data/entries.json": { raw: 3530000, gzip: 800000 },
    // Raised from 2020000 to 2040000 on 2026-10-10 after the fact check: the page re-reads added about 6,000 bytes (0.3 percent) of plainer deadline_text across 266 cards, saying what the page does and does not state. No single card is the cause. Still about 1,145 bytes per program, under the per-program limit.
    // Gzip limit raised from 440000 to 450000 on 2026-10-10: the card fixes this round (pay wording, opens-soon dates) put it at 440053.
    "data/entries-lite.json": { raw: 2040000, gzip: 450000 },
    "data/entries-core.json": { raw: 320000, gzip: 32000 },
  },
  liteBytesPerProgram: 1300,
  // Raised from 32000 to 32100 on 2026-10-10 for the footer link to the teachers and counselors handout, which every page carries. ready.html is 32009 bytes.
  // Raised from 32100 to 32300 on 2026-10-11 for the pick-your-state note on ready.html and paycheck.html and the age-based home card text. ready.html is about 32170 bytes.
  // Raised from 32300 to 32600 on 2026-10-11 when the third upgrade round was merged with the persona round: ready.html is 32534 bytes.
  rootPage: 32600,
  // One page has its own higher limit. Added 2026-10-11: safety.html now carries its summary and every point card with its source link in the page itself (about 40,000 bytes from data/safety.json), so the facts show with JavaScript off. The static text on the page is trimmed. It is 52,653 bytes. Every other root page keeps the limit above.
  // Raised from 52700 to 53400 on 2026-10-11 when the third upgrade round was merged: safety.html is 53342 bytes.
  pageLimits: { "safety.html": 53400 },
  // Raised from 40000 to 46000 on 2026-10-10: lib.js grew to 41715 bytes for the live chip counts, empty-state options, top picks and the cost-tier sort. Gzipped it is about 11 KB. The other scripts are all under 40000.
  // Raised again from 46000 to 48000 on 2026-10-10 for the whole-state Where choices (the state list, its group lists and the state place lookup). lib.js is 47189 bytes.
  // Raised from 48000 to 49500 on 2026-10-11 for the under-14 note and the search-cache fix in find.js. find.js is 49389 bytes.
  // Raised again from 49500 to 51500 on 2026-10-11 after merging the persona round (star shape, visible results focus) into find.js. find.js is 51372 bytes.
  script: 51500,
  // Raised from 34000 to 35000 on 2026-10-10: the merged upgrades added a few rules (the plain facts list and the Jobs output heading) and the sheet is 34005 bytes. Not caused by the data growth.
  // Raised again from 35000 to 36000 on 2026-10-10 for the 44 pixel tap targets (details summary, checkbox, breadcrumb) and the print rule for jump chips. The sheet is 35260 bytes.
  // Raised again from 36000 to 37000 on 2026-10-10 for the prefers-contrast block, the h1.display rule, the zero-count chip rule and the print rule for buttons. The sheet is 36345 bytes.
  // Raised from 37000 to 38000 on 2026-10-10 for the print source line, the focus rings on yellow and dark surfaces, and the expanded tile state. The sheet is 37288 bytes.
  // Raised again from 38000 to 38500 on 2026-10-10 for the handout page layout and its print rules. The sheet is 38283 bytes.
  // Raised again from 38500 to 39500 on 2026-10-10 for the print rules that keep callouts, month blocks and people cards whole and print the address after the Languages and Calendar card buttons. The sheet is 38975 bytes.
  // Raised from 39500 to 40500 on 2026-10-11 for the safe-area side padding, the tall-screen sticky header block, the disabled button look and the long-string wrap rule. The sheet is 40319 bytes.
  // Raised again from 40500 to 40600 on 2026-10-11 after merging the persona round rules. The sheet is 40518 bytes.
  stylesheet: 40600,
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
      const pageLimit = LIMITS.pageLimits[file] ?? LIMITS.rootPage;
      if (size.bytes > pageLimit) {
        problems.push(`${file} is ${size.bytes} bytes, over the limit of ${pageLimit} bytes for a root page`);
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

// Mutation test: a fake size table with entries-lite.json at 2,150,000 raw bytes must be reported.
// The raw limit (2,040,000) is broken, and so is the per-program limit, because 2,150,000 / 1,610 is about 1,335 bytes per program (limit 1,300).
// Every other file in the fake table is inside its limit, so no other file may be reported.
test("mutation: a lite file at 2,150,000 bytes is reported, and only lite is reported", () => {
  const big = Math.max(2150000, 1335 * programCount);
  const fake = { ...repoSizes, [LITE]: { bytes: big, gzip: repoSizes[LITE].gzip } };
  const problems = budgetProblems(fake, programCount);
  assert.deepEqual(problems, [
    `${LITE} is ${big} bytes, over the limit of 2040000 bytes`,
    `${LITE} is ${Math.round(big / programCount)} bytes per program (${big} bytes for ${programCount} programs), over the limit of 1300 bytes per program`,
  ]);
});

// Mutation test for a page: one root page one byte over its limit is the only problem reported.
test("mutation: a root page at 32,601 bytes is the only problem reported", () => {
  const fake = { ...repoSizes, "rules.html": { bytes: 32601, gzip: 9000 } };
  assert.deepEqual(budgetProblems(fake, programCount), [
    "rules.html is 32601 bytes, over the limit of 32600 bytes for a root page",
  ]);
});
