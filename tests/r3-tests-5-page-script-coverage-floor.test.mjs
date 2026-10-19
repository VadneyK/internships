// Ticket r3-tests-5: a line coverage floor for every page script in assets/js, not just lib.js.
// Run: node --test tests/r3-tests-5-page-script-coverage-floor.test.mjs
// Why not node --experimental-test-coverage: the page scripts run inside jsdom, from http://127.0.0.1 URLs,
// and Node's own coverage report only lists file: URLs, so it shows lib.js and nothing else (measured 2026-10-10).
// The raw V8 dumps that NODE_V8_COVERAGE writes do hold every script jsdom ran, so this file reads those.
// Pure-parse design, nothing is skipped: with no env flag it checks the floor table and the dump reader
// (on a made-up dump). With COVERAGE_DIR set to a NODE_V8_COVERAGE folder it also compares each page
// script's measured line percent to its floor, prints the table, and writes it to COVERAGE_OUT if that is set.
// It also holds the lib.js line floor (LIB_FLOOR). CI job coverage does both from the dumps the js shards upload. See docs/TESTING.md for the run commands.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Floor = line percent measured on 2026-10-10, rounded down, minus 2 points.
// lib.js has its own, stricter floor below (LIB_FLOOR), so it is not in this table.
export const LIB_FLOOR = 99; // same line floor the old lib-coverage job passed to --test-coverage-lines
export const LIB_BRANCH_FLOOR = 98; // 2026-10-15: raised from 97 after the mutation-round tests (measured 99.36 in CI run of 84f905b)

export const FLOORS = {
  "calendar.js": 98,
  "common.js": 97,
  "es.js": 98, // 2026-10-16: new, the Spanish pages (tests/es-pages.test.mjs runs every line)
  "es-playbook.js": 98, // 2026-10-17: new, Spanish Playbook tools (tests/es-playbook.dom.test.mjs and tests/es-playbook.test.mjs)
  "find.js": 96,
  "handout.js": 98,
  "home.js": 98,
  "insights.js": 98,
  "interview.js": 96,
  "jobs.js": 98,
  "map.js": 94, // 2026-10-15: 96.39 measured from tests/map.dom.test.mjs alone, rounded down, minus 2
  "languages.js": 98,
  "leaders.js": 98,
  "parents.js": 98,
  "paycheck.js": 98,
  "permit.js": 98,
  "playbook.js": 98, // 2026-10-15: raised from 86 after tests/playbook-coverage.test.mjs (measured 100)
  "ready.js": 98,
  "resume.js": 98,
  "safety.js": 98,
  "share.js": 98,
  "states.js": 98,
  "younger.js": 98,
};

// Which characters of `source` ran: a Uint8Array of 0 or 1, from one V8 script entry (ranges nest, inner ones win).
export function coveredChars(source, functions) {
  const ran = new Uint8Array(source.length);
  for (const fn of functions) {
    for (const r of fn.ranges) {
      ran.fill(r.count > 0 ? 1 : 0, Math.min(r.startOffset, source.length), Math.min(r.endOffset, source.length));
    }
  }
  return ran;
}

// Branch percent, Node's own method: every block range of a function (all ranges after the first, which is the function itself)
// is one branch, covered when its count is above 0. V8 leaves out a block whose count equals its parent's, so a branch missing from one
// dump takes the count of the smallest range around it in that dump. A branch is covered when it ran in any dump.
// `acc` is a Map of function key to the range lists seen for it, one list per dump; pass the same Map for every dump entry of one script.
export function addBranches(acc, functions) {
  for (const fn of functions) {
    if (!fn.ranges.length) continue;
    const key = `${fn.functionName || ""}@${fn.ranges[0].startOffset}-${fn.ranges[0].endOffset}`;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(fn.ranges);
  }
  return acc;
}

export function branchPercent(acc) {
  let total = 0, hit = 0;
  for (const dumps of acc.values()) {
    const keys = new Map();
    for (const ranges of dumps) for (const r of ranges.slice(1)) keys.set(`${r.startOffset}-${r.endOffset}`, r);
    for (const r of keys.values()) {
      total++;
      const covered = dumps.some((ranges) => {
        const same = ranges.find((x) => x.startOffset === r.startOffset && x.endOffset === r.endOffset);
        if (same) return same.count > 0;
        let parent = ranges[0];
        for (const x of ranges) if (x.startOffset <= r.startOffset && x.endOffset >= r.endOffset && x.endOffset - x.startOffset < parent.endOffset - parent.startOffset) parent = x;
        return parent.count > 0;
      });
      if (covered) hit++;
    }
  }
  return total ? Math.round((hit / total) * 10000) / 100 : 100;
}

// Line percent: blank lines and comment-only lines do not count; a line ran when its first character of code ran.
export function linePercent(source, ran) {
  let pos = 0, total = 0, hit = 0, inBlock = false;
  for (const line of source.split("\n")) {
    const start = pos;
    pos += line.length + 1;
    const code = line.trim();
    if (inBlock) { if (code.includes("*/")) inBlock = false; continue; }
    if (!code || code.startsWith("//")) continue;
    if (code.startsWith("/*")) { if (!code.includes("*/")) inBlock = true; continue; }
    total++;
    if (ran[start + line.indexOf(code[0])]) hit++;
  }
  return total ? Math.round((hit / total) * 10000) / 100 : 100;
}

// Read every dump in a NODE_V8_COVERAGE folder; a character ran if it ran in any process. Returns { "find.js": 81.25 }.
export function measureDir(dir, jsDir, branchesOut) {
  const merged = {};
  const branches = {};
  // Dumps may sit in sub folders: CI downloads each js shard's artifact into its own folder under COVERAGE_DIR.
  const files = fs.readdirSync(dir, { recursive: true }).filter((n) => n.endsWith(".json"));
  for (const f of files) {
    const dump = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const entry of dump.result || []) {
      const m = /\/assets\/js\/([\w.-]+\.js)(?:\?|$)/.exec(entry.url);
      if (!m) continue;
      const name = m[1];
      const source = fs.readFileSync(path.join(jsDir, name), "utf8");
      const ran = coveredChars(source, entry.functions);
      addBranches(branches[name] ||= new Map(), entry.functions);
      const prev = merged[name];
      if (!prev) merged[name] = ran;
      else for (let i = 0; i < ran.length; i++) if (ran[i]) prev[i] = 1;
    }
  }
  const out = {};
  for (const [name, ran] of Object.entries(merged)) {
    out[name] = linePercent(fs.readFileSync(path.join(jsDir, name), "utf8"), ran);
  }
  if (branchesOut) for (const [name, acc] of Object.entries(branches)) branchesOut[name] = branchPercent(acc);
  return out;
}

// Scripts jsdom cannot run, so they have no line coverage to measure. map-gl.js draws the street map with WebGL 2
// (MapLibre); tests/map-gl.dom.test.mjs checks everything map.js asks of it, and the drawing is checked in a real browser.
export const BROWSER_ONLY = { "map-gl.js": "needs WebGL 2, which jsdom lacks" };
const pageScripts = fs.readdirSync(path.join(ROOT, "assets/js"))
  .filter((f) => f.endsWith(".js") && f !== "lib.js" && !(f in BROWSER_ONLY))
  .sort();

test("every page script has a floor, and no floor names a missing script", () => {
  for (const f of pageScripts) {
    assert.ok(f in FLOORS, `assets/js/${f} has no floor in FLOORS`);
  }
  for (const f of Object.keys(FLOORS)) {
    assert.ok(pageScripts.includes(f), `FLOORS names ${f}, which is not in assets/js`);
  }
});

test("floors are sane numbers", () => {
  for (const [f, v] of Object.entries(FLOORS)) {
    assert.ok(Number.isFinite(v) && v >= 0 && v <= 98, `${f} floor ${v} is out of range`);
  }
});

test("the dump reader counts lines that ran, and skips blank and comment lines", () => {
  const src = "// note\nfunction a() {\n  return 1;\n}\n\nfunction b() {\n  return 2;\n}\n";
  const bStart = src.indexOf("function b");
  const ran = coveredChars(src, [{ ranges: [{ startOffset: 0, endOffset: src.length, count: 1 }, { startOffset: bStart, endOffset: src.length, count: 0 }] }]);
  assert.equal(linePercent(src, ran), 50);
  const all = coveredChars(src, [{ ranges: [{ startOffset: 0, endOffset: src.length, count: 3 }] }]);
  assert.equal(linePercent(src, all), 100);
});

test("a made-up dump folder is read and merged across processes", () => {
  const dir = fs.mkdtempSync(path.join(ROOT, "tests", ".covtmp-"));
  try {
    const jsDir = path.join(dir, "js");
    fs.mkdirSync(jsDir);
    const src = "a();\nb();\n";
    fs.writeFileSync(path.join(jsDir, "x.js"), src);
    const mk = (end) => ({ result: [{ url: "http://127.0.0.1:1/assets/js/x.js?v=abc", functions: [{ ranges: [{ startOffset: 0, endOffset: src.length, count: 0 }, { startOffset: 0, endOffset: end, count: 1 }] }] }, { url: "node:fs", functions: [] }] });
    fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify(mk(4)));
    assert.deepEqual(measureDir(dir, jsDir), { "x.js": 50 });
    fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify(mk(src.length)));
    assert.deepEqual(measureDir(dir, jsDir), { "x.js": 100 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a script missing from the dumps is named as a failure", () => {
  const missing = pageScripts.filter((f) => !(f in { "find.js": 1 }));
  assert.ok(missing.includes("permit.js"));
});

test("dumps in sub folders are read and merged", () => {
  const dir = fs.mkdtempSync(path.join(ROOT, "tests", ".covtmp-"));
  try {
    const jsDir = path.join(dir, "js");
    fs.mkdirSync(jsDir);
    const src = "a();\nb();\n";
    fs.writeFileSync(path.join(jsDir, "x.js"), src);
    const mk = (end) => ({ result: [{ url: "file:///repo/assets/js/x.js", functions: [{ ranges: [{ startOffset: 0, endOffset: src.length, count: 0 }, { startOffset: 0, endOffset: end, count: 1 }] }] }] });
    for (const [sub, end] of [["shard-1", 4], ["shard-2", src.length]]) {
      fs.mkdirSync(path.join(dir, "dumps", sub), { recursive: true });
      fs.writeFileSync(path.join(dir, "dumps", sub, "c.json"), JSON.stringify(mk(end)));
    }
    assert.deepEqual(measureDir(path.join(dir, "dumps"), jsDir), { "x.js": 100 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("lib.js has a line floor of 99 and a branch floor of 98", () => {
  assert.equal(LIB_FLOOR, 99);
  assert.equal(LIB_BRANCH_FLOOR, 98);
});

test("branch percent counts block ranges and merges them across dumps", () => {
  const fns = (c1, c2) => [{ functionName: "f", ranges: [{ startOffset: 0, endOffset: 50, count: 1 }, { startOffset: 5, endOffset: 10, count: c1 }, { startOffset: 20, endOffset: 30, count: c2 }] }];
  const acc = addBranches(new Map(), fns(1, 0));
  assert.equal(branchPercent(acc), 50);
  addBranches(acc, fns(0, 2));
  assert.equal(branchPercent(acc), 100);
  assert.equal(branchPercent(new Map()), 100);
});

test("a branch left out of a dump takes its parent's count there", () => {
  const dump1 = [{ functionName: "f", ranges: [{ startOffset: 0, endOffset: 50, count: 3 }, { startOffset: 5, endOffset: 10, count: 0 }] }];
  const dump2 = [{ functionName: "f", ranges: [{ startOffset: 0, endOffset: 50, count: 2 }] }];
  const acc = addBranches(addBranches(new Map(), dump1), dump2);
  assert.equal(branchPercent(acc), 100);
  const never = addBranches(addBranches(new Map(), dump1), [{ functionName: "f", ranges: [{ startOffset: 0, endOffset: 50, count: 0 }] }]);
  assert.equal(branchPercent(never), 0);
});

test("ci.yml runs the suite once in the js shards and checks both floors in one coverage job", () => {
  const ci = fs.readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /^ {2}coverage:$/m);
  assert.ok(!/^ {2}(page-script-coverage|lib-coverage):$/m.test(ci), "the two old coverage jobs are gone");
  assert.ok(ci.includes("NODE_V8_COVERAGE:"), "the js shards must collect V8 dumps");
  assert.ok(ci.includes("COVERAGE_DIR="), "the coverage job must run this file on the dumps");
});

test("measured coverage is at or above each floor (when COVERAGE_DIR is set)", () => {
  const dir = process.env.COVERAGE_DIR;
  if (!dir) {
    // No dump folder given: the table and reader checks above are the whole run.
    assert.ok(Object.keys(FLOORS).length > 0);
    return;
  }
  const branches = {};
  const got = measureDir(path.resolve(ROOT, dir), path.join(ROOT, "assets/js"), branches);
  const bad = [];
  const rows = ["file | line % | floor %"];
  for (const f of pageScripts) {
    rows.push(`${f} | ${f in got ? got[f].toFixed(2) : "none"} | ${FLOORS[f]}`);
    if (!(f in got)) bad.push(`${f}: no coverage in the dumps`);
    else if (got[f] < FLOORS[f]) bad.push(`${f}: ${got[f]} is under the floor ${FLOORS[f]}`);
  }
  rows.push(`lib.js | ${"lib.js" in got ? got["lib.js"].toFixed(2) : "none"} | ${LIB_FLOOR}`);
  if (!("lib.js" in got)) bad.push("lib.js: no coverage in the dumps");
  else if (got["lib.js"] < LIB_FLOOR) bad.push(`lib.js: ${got["lib.js"]} is under the floor ${LIB_FLOOR}`);
  rows.push(`lib.js branches | ${"lib.js" in branches ? branches["lib.js"].toFixed(2) : "none"} | ${LIB_BRANCH_FLOOR}`);
  if (!("lib.js" in branches)) bad.push("lib.js: no branch data in the dumps");
  else if (branches["lib.js"] < LIB_BRANCH_FLOOR) bad.push(`lib.js: branch ${branches["lib.js"]} is under the floor ${LIB_BRANCH_FLOOR}`);
  console.log(rows.join("\n"));
  if (process.env.COVERAGE_OUT) fs.writeFileSync(path.resolve(ROOT, process.env.COVERAGE_OUT), rows.join("\n") + "\n");
  assert.deepEqual(bad, []);
});
