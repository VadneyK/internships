// r1-tests-7: every data/*.json names only program ids, state codes and region ids that exist.
// Walks each file once, finds string values under the watched keys, and checks each against the right list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const files = readdirSync(dataDir).filter((f) => f.endsWith(".json")).sort();
const DATA = Object.fromEntries(files.map((f) => [f, readJson(join(dataDir, f))]));
const ENTRIES = DATA["entries.json"];
const PROGRAM_IDS = new Set(ENTRIES.map((e) => e.id));
const REGION_IDS = new Set(L.REGIONS.map((r) => r[0]));
const HUB_IDS = new Set(L.HUBS.map((h) => h[0]));
const STATE_CODES = new Set(Object.keys(DATA["permits.json"].states));
const STATE_NAMES = new Set(Object.values(DATA["permits.json"].states).map((s) => s.name));
const ALL_STATES = "All states"; // documented in docs/ADDING_A_REGION.md step 6d

const WATCHED = new Set(["id", "ids", "entry", "entry_id", "program", "programs", "state", "states", "region", "regions", "hub", "hubs"]);

// What a watched value must be, by file and path ("[]" stands for any array index).
// "skip:" rules name things that are not program, state or region references.
const RULES = [
  [/^entries(-[a-z]+)?\.json$/, /^\[\]\.id$/, "program"],
  [/^entries(-[a-z]+)?\.json$/, /^\[\]\.regions$/, "region"],
  [/^calendar\.json$/, /^\.items\[\]\.id$/, "program"],
  [/^gaps\.json$/, /^\[\]\.hubs$/, "hub"],
  [/^gaps\.json$/, /^\[\]\.id$/, "skip: gap ids name a gap group, not a program"],
  [/^employers\.json$/, /^\.employers\[\]\.id$/, "skip: employer ids name an employer row, not an entry"],
  [/^employers\.json$/, /^\.rules\[\]\.id$/, "skip: rule ids name a rule row"],
  [/^money\.json$/, /^\.presets\[\]\.id$/, "skip: preset ids name a pay preset such as ny-nyc"],
  [/^money\.json$/, /^\.presets\[\]\.state$/, "state"],
  [/^money\.json$/, /^\.states\[\]\.id$/, "state"],
  [/^money\.json$/, /^\.states$/, "skip: container, its rows are checked"],
  [/^parents\.json$/, /^\.sign\.states\[\]\.id$/, "state"],
  [/^parents\.json$/, /^\.sign\.states$/, "skip: container, its rows are checked"],
  [/^permits\.json$/, /^\.states$/, "skip: container, its keys are checked as state codes"],
  [/^permits\.json$/, /^\.states\.[a-z]+\.kinds\.program$/, "skip: program is a kind of job (permit and text), not an entry id"],
  [/^languages\.json$/, /^\.rows\[\]\.state$/, "stateName"],
  [/^transit\.json$/, /^\.places\[\]\.state$/, "stateName"],
  [/^transit\.json$/, /^\.places\[\]\.id$/, "skip: transit place ids name a city"],
  [/^safety\.json$/, /^\.sections\[\]\.id$/, "skip: section ids name a page section"],
  [/^states-lite\.json$/, /^\.states\[\]\.id$/, "skip: these are the states that are not in permits.json (30 other states), so they are not state codes of the permit finder"],
  [/^states-lite\.json$/, /^\.states$/, "skip: container, its rows are checked"],
  [/^state-wages\.json$/, /^\.states\[\]\.id$/, "skip: these are all 50 states and DC, checked by tests/p7-wages-1.test.mjs"],
  [/^state-wages\.json$/, /^\.states$/, "skip: container, its rows are checked"],
  [/^younger\.json$/, /^\.states$/, "statePairs"],
  [/^map\.json$/, /^\.(points|bc)\[\]\.ids$/, "program"],
  [/^geo-overrides\.json$/, /^\.(byId\.[a-z0-9-]+|byCity\..+)\.state$/, "skip: a two-letter postal code (CA, BC) the geocoder uses, not a permit finder state; map.json ids are checked by tests/r3-tests-8-map-data.test.mjs"],
];

const found = []; // { file, path, kind, value }
const unclassified = [];
function visit(file, node, path) {
  if (Array.isArray(node)) { node.forEach((v) => visit(file, v, path + "[]")); return; }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    const p = path + "." + k;
    // Normalise "[].key" at the top level and drop the leading "." for arrays at the root.
    const norm = p.replace(/^\.\[\]/, "[]");
    if (WATCHED.has(k)) {
      const rule = RULES.find((r) => r[0].test(file) && r[1].test(norm));
      if (!rule) unclassified.push(`${file} ${norm}`);
      else if (!rule[2].startsWith("skip:")) {
        if (rule[2] === "statePairs") for (const pair of v) found.push({ file, path: norm, kind: "state", value: pair[0] });
        else (Array.isArray(v) ? v : [v]).forEach((x) => found.push({ file, path: norm, kind: rule[2], value: x }));
      }
    }
    visit(file, v, norm);
  }
}
for (const f of files) visit(f, DATA[f], "");

const CHECK = {
  program: (v) => PROGRAM_IDS.has(v),
  region: (v) => REGION_IDS.has(v),
  hub: (v) => HUB_IDS.has(v),
  state: (v) => STATE_CODES.has(v),
  stateName: (v) => v === ALL_STATES || STATE_NAMES.has(v),
};

test("every watched key in data/*.json has a rule (new keys must be classified or skipped with a reason)", () => {
  assert.deepEqual([...new Set(unclassified)], []);
});

for (const kind of Object.keys(CHECK)) {
  test(`every ${kind} reference in data/*.json exists`, () => {
    const mine = found.filter((f) => f.kind === kind);
    assert.ok(mine.length > 0, `no ${kind} references found, the walker is not seeing the data`);
    const bad = mine.filter((f) => typeof f.value !== "string" || !CHECK[kind](f.value)).map((f) => `${f.file} ${f.path}: ${JSON.stringify(f.value)}`);
    assert.deepEqual(bad, []);
  });
}

test("every state code in permits.json keys is a two letter code", () => {
  assert.deepEqual([...STATE_CODES].filter((c) => !/^[a-z]{2}$/.test(c)), []);
});

test("each data/entries.json id has a data/programs/<id>.json file and the other way round", () => {
  const onDisk = new Set(readdirSync(join(dataDir, "programs")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)));
  assert.equal(PROGRAM_IDS.size, ENTRIES.length, "duplicate ids in entries.json");
  assert.deepEqual([...PROGRAM_IDS].filter((id) => !onDisk.has(id)).sort(), [], "entries without a program file");
  assert.deepEqual([...onDisk].filter((id) => !PROGRAM_IDS.has(id)).sort(), [], "program files without an entry");
  for (const id of PROGRAM_IDS) assert.ok(existsSync(join(dataDir, "programs", id + ".json")));
});
