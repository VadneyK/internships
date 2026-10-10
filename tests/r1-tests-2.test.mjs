// Cross-file id and reference checks for data/*.json.
// Run with: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const readJSON = (rel) => JSON.parse(fs.readFileSync(new URL("../data/" + rel, import.meta.url), "utf8"));
const readText = (rel) => fs.readFileSync(new URL("../data/" + rel, import.meta.url), "utf8");

// Minimal RFC 4180 parser: handles quoted fields, doubled quotes and newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\r") { /* skip, handled by the \n */ }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function duplicates(list) {
  const seen = new Set();
  const dupes = new Set();
  for (const x of list) {
    if (seen.has(x)) dupes.add(x);
    seen.add(x);
  }
  return [...dupes];
}

function onlyIn(a, b) {
  const bset = new Set(b);
  return [...new Set(a)].filter((x) => !bset.has(x));
}

function expectNone(list, label) {
  assert.equal(list.length, 0, label + ": " + list.join(", "));
}

function loadProgramFiles() {
  const dir = new URL("../data/programs/", import.meta.url);
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(new URL(f, dir), "utf8")) }));
}

const ENTRIES = readJSON("entries.json");
const META = readJSON("meta.json");
const CALENDAR = readJSON("calendar.json");
const GAPS = readJSON("gaps.json");
const PROGRAMS = loadProgramFiles();
const CSV_ROWS = parseCsv(readText("entries.csv"));

test("entries.json, data/programs and entries.csv hold the same program ids", () => {
  const programIds = PROGRAMS.map((p) => p.data.id);
  const entryIds = ENTRIES.map((e) => e.id);
  const csvIds = CSV_ROWS.slice(1).map((r) => r[0]);

  expectNone(duplicates(programIds), "duplicate id in data/programs");
  expectNone(duplicates(entryIds), "duplicate id in data/entries.json");
  expectNone(duplicates(csvIds), "duplicate id in data/entries.csv");

  expectNone(onlyIn(programIds, entryIds), "id in data/programs but missing from data/entries.json");
  expectNone(onlyIn(entryIds, programIds), "id in data/entries.json but missing from data/programs");
  expectNone(onlyIn(programIds, csvIds), "id in data/programs but missing from data/entries.csv");
  expectNone(onlyIn(csvIds, programIds), "id in data/entries.csv but missing from data/programs");
});

test("meta.count equals the number of programs", () => {
  const n = new Set(PROGRAMS.map((p) => p.data.id)).size;
  assert.equal(META.count, n, "meta.count " + META.count + " does not match " + n + " program ids");
  assert.equal(ENTRIES.length, n, "data/entries.json length does not match the program count");
  assert.equal(CSV_ROWS.length - 1, n, "data/entries.csv data rows do not match the program count");
});

test("meta.verified_on_official_site equals the count of programs with verified fetched", () => {
  const fetched = PROGRAMS.filter((p) => p.data.verified === "fetched").map((p) => p.data.id);
  assert.equal(
    META.verified_on_official_site,
    fetched.length,
    "meta.verified_on_official_site " + META.verified_on_official_site + " does not match " + fetched.length + " fetched programs"
  );
  const fetchedInEntries = ENTRIES.filter((e) => e.verified === "fetched").length;
  assert.equal(fetchedInEntries, fetched.length, "data/entries.json fetched count does not match data/programs");
});

test("calendar.json: every item id is a real program, ids are unique, and opens and closes are valid", () => {
  assert.ok(Array.isArray(CALENDAR.items), "calendar.json needs an items array");
  const programIds = new Set(PROGRAMS.map((p) => p.data.id));
  const calIds = CALENDAR.items.map((i) => i.id);

  expectNone(duplicates(calIds), "duplicate calendar id");
  expectNone(calIds.filter((id) => !programIds.has(id)), "calendar id with no program in data/programs");

  const badMonth = [];
  const badQuote = [];
  for (const item of CALENDAR.items) {
    for (const key of ["opens", "closes"]) {
      const v = item[key];
      const ok = v === null || (Number.isInteger(v) && v >= 1 && v <= 12);
      if (!ok) badMonth.push(item.id + " " + key + "=" + JSON.stringify(v));
    }
    if (typeof item.quote !== "string" || item.quote.trim() === "") badQuote.push(String(item.id));
  }
  expectNone(badMonth, "calendar item with opens or closes that is not null or a month 1 to 12");
  expectNone(badQuote, "calendar item with an empty quote");
});

test("gaps.json: every hub is a known lib.HUBS id, issues are positive integers, gap ids are unique", () => {
  assert.ok(Array.isArray(GAPS), "gaps.json needs to be an array");
  const hubIds = new Set(L.HUBS.map((h) => h[0]));
  const badHub = [];
  const badIssue = [];
  for (const gap of GAPS) {
    for (const h of gap.hubs || []) {
      if (!hubIds.has(h)) badHub.push(gap.id + " has unknown hub " + JSON.stringify(h));
    }
    if (!Number.isInteger(gap.issue) || gap.issue <= 0) badIssue.push(gap.id + " issue=" + JSON.stringify(gap.issue));
  }
  expectNone(badHub, "gap with a hub that is not in lib.HUBS");
  expectNone(badIssue, "gap with an issue that is not a positive integer");
  expectNone(duplicates(GAPS.map((g) => g.id)), "duplicate gap id");
});
