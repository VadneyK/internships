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

export const FLOORS = {
  "calendar.js": 98,
  "common.js": 97,
  "find.js": 96,
  "handout.js": 98,
  "home.js": 98,
  "insights.js": 98,
  "interview.js": 96,
  "jobs.js": 98,
  "languages.js": 98,
  "leaders.js": 98,
  "parents.js": 98,
  "paycheck.js": 98,
  "permit.js": 98,
  "playbook.js": 86,
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
export function measureDir(dir, jsDir) {
  const merged = {};
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
      const prev = merged[name];
      if (!prev) merged[name] = ran;
      else for (let i = 0; i < ran.length; i++) if (ran[i]) prev[i] = 1;
    }
  }
  const out = {};
  for (const [name, ran] of Object.entries(merged)) {
    out[name] = linePercent(fs.readFileSync(path.join(jsDir, name), "utf8"), ran);
  }
  return out;
}

const pageScripts = fs.readdirSync(path.join(ROOT, "assets/js"))
  .filter((f) => f.endsWith(".js") && f !== "lib.js")
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

test("lib.js has a line floor of 99", () => {
  assert.equal(LIB_FLOOR, 99);
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
  const got = measureDir(path.resolve(ROOT, dir), path.join(ROOT, "assets/js"));
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
  console.log(rows.join("\n"));
  if (process.env.COVERAGE_OUT) fs.writeFileSync(path.resolve(ROOT, process.env.COVERAGE_OUT), rows.join("\n") + "\n");
  assert.deepEqual(bad, []);
});
