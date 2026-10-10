#!/usr/bin/env node
// Speed numbers for the program list: matches, sortList, the place counts and JSON.parse of the data files.
// Run it before and after a change and compare the numbers. Run it with: node tools/bench-matches.mjs
//
//   --json        print one JSON object instead of text lines
//   --runs N      timed runs per scenario (default 20). One warm-up run is not timed.
//
// Each scenario prints its median and p95 time in milliseconds. The program count in data/entries.json
// must match data/meta.json, or the script exits 1 (the numbers would not mean what they say).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const L = require(path.join(ROOT, "assets", "js", "lib.js"));

const USAGE = "usage: node tools/bench-matches.mjs [--json] [--runs N]\n";

function parseArgs(argv) {
  const opts = { json: false, runs: 20, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--runs") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) throw new Error("--runs needs a whole number of 1 or more");
      opts.runs = n;
    } else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`${err.message}\n${USAGE}`);
  process.exit(2);
}
if (opts.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const readData = (file) => fs.readFileSync(path.join(DATA, file), "utf8");
const meta = JSON.parse(readData("meta.json"));
const entriesText = readData("entries.json");
const entries = JSON.parse(entriesText);

if (entries.length !== meta.count) {
  process.stderr.write(
    `data/entries.json has ${entries.length} programs but data/meta.json says ${meta.count}. Run python3 tools/build_data.py first.\n`
  );
  process.exit(1);
}

// Read every file once, outside the timed part. The parse scenarios time only JSON.parse.
const parseTexts = {
  "parse.entries": entriesText,
  "parse.lite": readData("entries-lite.json"),
  "parse.card": readData("entries-card.json"),
  "parse.core": readData("entries-core.json"),
};

// One fixed clock for every call, so the same programs are open or closed in every run.
const NOW = Date.now();

// Place keys in the same form the page uses: "city:<id>" for each city, "area:<id>" for each area.
const PLACES = [
  ...L.CITIES.map((c) => `city:${c[0]}`),
  ...L.AREAS.map((a) => `area:${a[0]}`),
];

// The count loop from assets/js/common.js fillPlaces. Uses L.placeCounts when lib.js has one.
// The signature of L.placeCounts is not defined yet. This assumes (entries, now) and returns the counts.
function placeCounts() {
  if (typeof L.placeCounts === "function") return L.placeCounts(entries, NOW);
  const counts = new Array(PLACES.length);
  for (let p = 0; p < PLACES.length; p++) {
    let n = 0;
    for (const e of entries) if (L.matches(e, { place: PLACES[p] }, NOW)) n++;
    counts[p] = n;
  }
  return counts;
}

const countMatches = (state) => {
  let n = 0;
  for (const e of entries) if (L.matches(e, state, NOW)) n++;
  return n;
};

// Each scenario returns a value so the work is not optimized away. The value is kept in `sink`.
const SCENARIOS = {
  "matches.empty": () => countMatches({}),
  "matches.q1": () => countMatches({ q: "youth" }),
  "matches.q2": () => countMatches({ q: "summer program" }),
  "matches.place": () => countMatches({ place: "city:davis" }),
  "matches.ageHubsFields": () => countMatches({ age: 15, hubs: ["davis", "oak"], fields: ["health", "tech-cs"] }),
  "sortList.best": () => L.sortList(entries, "best", NOW).length,
  "sortList.deadline": () => L.sortList(entries, "deadline", NOW).length,
  "sortList.name": () => L.sortList(entries, "name", NOW).length,
  placeCounts: () => placeCounts().length,
  "parse.entries": () => JSON.parse(parseTexts["parse.entries"]).length,
  "parse.lite": () => JSON.parse(parseTexts["parse.lite"]).length,
  "parse.card": () => JSON.parse(parseTexts["parse.card"]).length,
  "parse.core": () => JSON.parse(parseTexts["parse.core"]).length,
};

let sink = 0;

const round = (x) => Math.round(x * 1000) / 1000;

function summarize(ms) {
  const sorted = ms.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const p95 = sorted[Math.ceil(0.95 * n) - 1];
  return { median_ms: round(median), p95_ms: round(p95) };
}

function timeScenario(fn, runs) {
  sink = fn(); // warm-up, not timed
  const ms = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    sink = fn();
    ms.push(performance.now() - t0);
  }
  return summarize(ms);
}

const scenarios = {};
for (const [key, fn] of Object.entries(SCENARIOS)) {
  scenarios[key] = timeScenario(fn, opts.runs);
}

if (opts.json) {
  process.stdout.write(JSON.stringify({ programs: entries.length, runs: opts.runs, scenarios }, null, 2) + "\n");
} else {
  for (const [key, s] of Object.entries(scenarios)) {
    process.stdout.write(
      `${key.padEnd(24)} median ${s.median_ms.toFixed(3).padStart(9)} ms   p95 ${s.p95_ms.toFixed(3).padStart(9)} ms\n`
    );
  }
}
