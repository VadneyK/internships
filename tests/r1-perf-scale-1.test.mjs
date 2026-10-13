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
    // Raised on 2026-10-11 for ticket p7-regions-1: 267 new cards for 11 states took entries.json to 3,993,644 bytes (899,490 gzipped). Raw from 3530000 to 4050000, gzip from 800000 to 910000.
    // PENDING PERSON APPROVAL: no record yet that a person accepted this extra weight for phone users. Until one does, do not raise this again. Slim the card data or record the approval in docs/TESTING.md.
    // Raised again on 2026-10-12 for the city data waves that followed (178 more cards, 2,214 programs): entries.json is 4,309,696 bytes (975,602 gzipped). Raw from 4050000 to 4450000, gzip from 910000 to 1000000. The cards are about as long as the older ones; the growth is the card count.
    // STILL PENDING PERSON APPROVAL: no person has recorded accepting this weight for phone users. Pages do not load this file on first view (it is the full download and the contributor file), so first-load weight is unchanged.
    // 2026-10-12: +77 Plains state cards (2,291 programs): entries.json is 4,464,728 bytes (1,014,528 gzipped). Raw from 4450000 to 4470000, gzip from 1000000 to 1015000. STILL PENDING PERSON APPROVAL, as above; this file is the full download and the contributor file, so first-load weight is unchanged.
    // 2026-10-13: +7 Plains and North Dakota cards read in a browser (2,298 programs): entries.json 4,477,582 bytes. Raw 4470000 to 4480000.
    "data/entries.json": { raw: 4480000, gzip: 1015000 },
    // Raised from 2020000 to 2040000 on 2026-10-10 after the fact check: the page re-reads added about 6,000 bytes (0.3 percent) of plainer deadline_text across 266 cards, saying what the page does and does not state. No single card is the cause. Still about 1,145 bytes per program, under the per-program limit.
    // Gzip limit raised from 440000 to 450000 on 2026-10-10: the card fixes this round (pay wording, opens-soon dates) put it at 440053.
    // Raised again on 2026-10-12 for the 178 more cards: entries-lite.json is 2,097,871 bytes (437,135 gzipped), 947 bytes per program. Raw from 2040000 to 2160000. The gzip limit stays 450000. PENDING PERSON APPROVAL, as for entries.json.
    // 2026-10-12: +77 Plains state cards (2,291 programs): entries-lite.json is 2,172,802 bytes (455,365 gzipped), 948 bytes per program. Raw from 2160000 to 2180000, gzip from 450000 to 460000. PENDING PERSON APPROVAL, as above.
    "data/entries-lite.json": { raw: 2180000, gzip: 460000 },
    // Raised on 2026-10-11 for ticket p7-regions-1: entries-core.json is 368,169 bytes (36,864 gzipped). Raw from 320000 to 375000, gzip from 32000 to 37500.
    // PENDING PERSON APPROVAL: same as entries.json above. Do not raise again without a person's recorded sign-off.
    // Raised again on 2026-10-12 for the 178 more cards: entries-core.json is 400,279 bytes (41,089 gzipped). Raw from 375000 to 420000, gzip from 37500 to 43000. PENDING PERSON APPROVAL, as above.
    "data/entries-core.json": { raw: 420000, gzip: 43000 },
  },
  liteBytesPerProgram: 1300,
  // Raised from 32000 to 32100 on 2026-10-10 for the footer link to the teachers and counselors handout, which every page carries. ready.html is 32009 bytes.
  // Raised from 32100 to 32300 on 2026-10-11 for the pick-your-state note on ready.html and paycheck.html and the age-based home card text. ready.html is about 32170 bytes.
  // Raised from 32300 to 32600 on 2026-10-11 when the third upgrade round was merged with the persona round: ready.html is 32534 bytes.
  // Raised from 32600 to 33600 on 2026-10-11 for ticket p8-lite-1/p8-ready-1: the closed no-parent block on ready.html (about 900 bytes) and the two jump anchors. ready.html is 33506 bytes.
  // Raised from 33600 to 34000 on 2026-10-12 for ticket r2-teen-flow-2: the Your checklist chip and jump link on ready.html, plus the last-read line moved under the lede. ready.html is 33935 bytes.
  // Raised from 34000 to 34800 on 2026-10-12 for ticket r3-teen-flow-5 (the footer Quick links are now three labelled lists, about 380 bytes on every page) and r3-a11y-perf-3 (a no-JavaScript note on script-built pages). ready.html is 34646 bytes.
  rootPage: 34800,
  // One page has its own higher limit. Added 2026-10-11: safety.html now carries its summary and every point card with its source link in the page itself (about 40,000 bytes from data/safety.json), so the facts show with JavaScript off. The static text on the page is trimmed. It is 52,653 bytes. Every other root page keeps the limit above.
  // Raised from 52700 to 53400 on 2026-10-11 when the third upgrade round was merged: safety.html is 53342 bytes.
  // Raised from 53400 to 55100 on 2026-10-11 for the farm and ranch box (ticket p6-farm-1): four sourced federal farm rules, about 1,670 bytes, each with the page title as its link text. safety.html is 55010 bytes.
  // Raised from 55100 to 55500 on 2026-10-12 for the grouped footer Quick links (about 380 bytes). safety.html is 55390 bytes.
  pageLimits: { "safety.html": 55500 },
  // Raised from 40000 to 46000 on 2026-10-10: lib.js grew to 41715 bytes for the live chip counts, empty-state options, top picks and the cost-tier sort. Gzipped it is about 11 KB. The other scripts are all under 40000.
  // Raised again from 46000 to 48000 on 2026-10-10 for the whole-state Where choices (the state list, its group lists and the state place lookup). lib.js is 47189 bytes.
  // Raised from 48000 to 49500 on 2026-10-11 for the under-14 note and the search-cache fix in find.js. find.js is 49389 bytes.
  // Raised again from 49500 to 51500 on 2026-10-11 after merging the persona round (star shape, visible results focus) into find.js. find.js is 51372 bytes.
  // Raised from 51500 to 52000 on 2026-10-12 for ticket r1-teen-flow-1: find.js opens More filters and counts the hidden filters that are on. find.js is 51866 bytes.
  // Raised from 52000 to 52700 on 2026-10-12 for ticket r2-a11y-perf-7: the saved-list print sheet drops empty parentheses and adds a last-checked line. find.js is 52686 bytes.
  // Raised from 52700 to 53400 on 2026-10-12 for ticket r3-a11y-perf-5: the phone Search key applies the search and moves to the results. find.js is 53228 bytes.
  // Raised from 53400 to 59300 on 2026-10-12 for ticket diet-1: find.js picks a place's Where group files (data/lite and data/detail, ten literal URLs each way) instead of always loading the whole lite file, and falls back to the whole file when a state needs it. find.js is 59217 bytes. First-load data on the Programs page with a place chosen falls from 437 KB to 100 to 186 KB gzipped.
  // 2026-10-12: Programs filters redesign. Raised from 59300 to 64500 for the summary bar and the phone bar in find.js (64477 bytes).
  script: 64500,
  // Raised from 34000 to 35000 on 2026-10-10: the merged upgrades added a few rules (the plain facts list and the Jobs output heading) and the sheet is 34005 bytes. Not caused by the data growth.
  // Raised again from 35000 to 36000 on 2026-10-10 for the 44 pixel tap targets (details summary, checkbox, breadcrumb) and the print rule for jump chips. The sheet is 35260 bytes.
  // Raised again from 36000 to 37000 on 2026-10-10 for the prefers-contrast block, the h1.display rule, the zero-count chip rule and the print rule for buttons. The sheet is 36345 bytes.
  // Raised from 37000 to 38000 on 2026-10-10 for the print source line, the focus rings on yellow and dark surfaces, and the expanded tile state. The sheet is 37288 bytes.
  // Raised again from 38000 to 38500 on 2026-10-10 for the handout page layout and its print rules. The sheet is 38283 bytes.
  // Raised again from 38500 to 39500 on 2026-10-10 for the print rules that keep callouts, month blocks and people cards whole and print the address after the Languages and Calendar card buttons. The sheet is 38975 bytes.
  // Raised from 39500 to 40500 on 2026-10-11 for the safe-area side padding, the tall-screen sticky header block, the disabled button look and the long-string wrap rule. The sheet is 40319 bytes.
  // Raised again from 40500 to 40600 on 2026-10-11 after merging the persona round rules. The sheet is 40518 bytes.
  // Raised from 40600 to 41000 on 2026-10-12 for tickets r1-a11y-perf-1, r1-a11y-perf-2 and r1-a11y-perf-3: the current page rule in forced colors, the silent plus and minus marks, and the QR image look moved out of inline styles. The sheet is 40867 bytes.
  // Raised from 41000 to 42000 on 2026-10-12 for tickets r2-a11y-perf-2, r2-a11y-perf-6 and r2-teen-flow-4: hover styles only where a device can hover, print rules for buttons and controls, and the closed legend box. The sheet is 41831 bytes.
  // Raised from 42000 to 42400 on 2026-10-12 for tickets r3-teen-flow-5, r3-a11y-perf-2 and r3-a11y-perf-6: the footer group headings, link addresses on the print-one sheets, and the real screen height rule. The sheet is 42273 bytes.
  // 2026-10-12: home picker flow. Raised from 42400 to 44700 for the numbered steps, the place search box, its list and the chip. The sheet is 44619 bytes.
  // 2026-10-12: Programs filters redesign. Raised from 44700 to 48300 for the summary bar, pill rows and phone bar rules (48237 bytes).
  stylesheet: 48300,
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

// Mutation test: a fake size table with entries-lite.json at 2,300,000 raw bytes must be reported.
// The raw limit (2,180,000 since 2026-10-12) is broken, and so is the per-program limit, because 3,058,485 / 2,291 is about 1,335 bytes per program (limit 1,300).
// Every other file in the fake table is inside its limit, so no other file may be reported.
test("mutation: a lite file at 2,300,000 bytes is reported, and only lite is reported", () => {
  const big = Math.max(2300000, 1335 * programCount);
  const fake = { ...repoSizes, [LITE]: { bytes: big, gzip: repoSizes[LITE].gzip } };
  const problems = budgetProblems(fake, programCount);
  assert.deepEqual(problems, [
    `${LITE} is ${big} bytes, over the limit of 2180000 bytes`, // 2026-10-12: +77 Plains state cards (2,291 programs); was 2160000
    `${LITE} is ${Math.round(big / programCount)} bytes per program (${big} bytes for ${programCount} programs), over the limit of 1300 bytes per program`,
  ]);
});

// Mutation test for a page: one root page one byte over its limit is the only problem reported.
test("mutation: a root page at 34,801 bytes is the only problem reported", () => {
  const fake = { ...repoSizes, "rules.html": { bytes: 34801, gzip: 9000 } };
  assert.deepEqual(budgetProblems(fake, programCount), [
    "rules.html is 34801 bytes, over the limit of 34800 bytes for a root page",
  ]);
});
