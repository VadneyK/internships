// Shape and integrity checks for the data files outside data/programs (ticket r1-tests-3).
// gaps.json, calendar.json, money, parents, younger, languages, transit, safety, interview,
// employers and permits had only page-level tests. These rules catch a hub typo, a month 13,
// a duplicate id, an empty string or an http link before it ships.
// Each rule is a pure function. The seeded-bad tests prove every rule fires.
// Run with: node --test tests/r1-tests-3-aux-data-shape.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

const SKIP = new Set(["entries.json", "entries.csv", "expiring-dates.json"]);
const AUX = fs.readdirSync(path.join(root, "data"))
  .filter((f) => f.endsWith(".json") && !f.startsWith("entries") && !SKIP.has(f))
  .sort();

// "url" and "href" must be absolute https. "u" and "link" may also be a path on this site
// (permits.json links to rules.html#permit), but never http: or another scheme.
const STRICT_URL_KEYS = new Set(["url", "href"]);
const LOOSE_URL_KEYS = new Set(["u", "link"]);
// safety.json numbers[].label is "" on purpose when a hotline has one number (safety.js numberLine omits it).
const EMPTY_OK = /\.numbers\[\d+\]\.label$/;
// Real defects found by this file, kept visible instead of weakened away. The test below
// fails when one is fixed, so the entry must then be deleted.
const KNOWN_DEFECTS = [
  { file: "gaps.json", problem: "$[4].hubs: empty or missing", why: "gap \"confirm-first\" has no hubs, so find.js never shows it (fix in data/gaps.json)" },
];

// ---- rules: each returns a list of "path: problem" strings ----
function walk(node, p, visit) {
  visit(node, p);
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${p}[${i}]`, visit));
  else if (node && typeof node === "object") Object.keys(node).forEach((k) => walk(node[k], `${p}.${k}`, visit));
}
function emptyStrings(data) {
  const out = [];
  walk(data, "$", (v, p) => { if (typeof v === "string" && v.trim() === "" && !EMPTY_OK.test(p)) out.push(`${p}: empty string`); });
  return out;
}
function badLinks(data) {
  const out = [];
  walk(data, "$", (v, p) => {
    if (typeof v !== "string") return;
    const key = p.split(".").pop().replace(/\[\d+\]$/, "");
    if (/^\s*http:/i.test(v)) out.push(`${p}: http link`);
    else if (STRICT_URL_KEYS.has(key) && !/^https:\/\/[^\s]+$/.test(v)) out.push(`${p}: url is not https`);
    else if (LOOSE_URL_KEYS.has(key) && (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https:\/\/[^\s]+$/.test(v))) out.push(`${p}: url is not https`);
    else if (LOOSE_URL_KEYS.has(key) && /\s/.test(v)) out.push(`${p}: url has a space`);
  });
  return out;
}
function dupIds(data) {
  const out = [];
  walk(data, "$", (v, p) => {
    if (!Array.isArray(v)) return;
    const seen = new Set();
    v.forEach((o, i) => {
      if (!o || typeof o !== "object" || Array.isArray(o) || !("id" in o)) return;
      if (seen.has(o.id)) out.push(`${p}[${i}]: duplicate id "${o.id}"`);
      seen.add(o.id);
    });
  });
  return out;
}
const isMonth = (m) => m === null || (Number.isInteger(m) && m >= 1 && m <= 12);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function readToIso(s) {
  const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(s || "");
  if (!m || MON.indexOf(m[1]) < 0) return "";
  return `${m[3]}-${String(MON.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
function gapsProblems(gaps, hubIds) {
  const out = [];
  if (!Array.isArray(gaps)) return ["$: not an array"];
  const seen = new Set();
  gaps.forEach((g, i) => {
    const p = `$[${i}]`;
    if (typeof g.id !== "string" || !g.id) out.push(`${p}.id: missing`);
    else if (seen.has(g.id)) out.push(`${p}.id: duplicate "${g.id}"`);
    else seen.add(g.id);
    if (!Array.isArray(g.hubs) || !g.hubs.length) out.push(`${p}.hubs: empty or missing`);
    else g.hubs.forEach((h, j) => { if (!hubIds.includes(h)) out.push(`${p}.hubs[${j}]: unknown hub "${h}"`); });
    if (!(g.issue === null || (Number.isInteger(g.issue) && g.issue > 0))) out.push(`${p}.issue: not a positive integer or null`);
    ["title", "text"].forEach((k) => {
      const v = g[k];
      if (typeof v !== "string" || !v.trim()) out.push(`${p}.${k}: empty`);
      else if (v !== v.trim()) out.push(`${p}.${k}: leading or trailing space`);
    });
  });
  return out;
}
function calendarProblems(cal, entryIds, buildIso) {
  const out = [];
  const items = Array.isArray(cal && cal.items) ? cal.items : [];
  if (!items.length) out.push("$.items: empty or missing");
  const iso = readToIso(cal && cal.read);
  if (!iso || !L.parseISO(iso)) out.push(`$.read: "${cal && cal.read}" does not parse`);
  else if (iso > buildIso) out.push(`$.read: ${iso} is after the build date ${buildIso}`);
  items.forEach((it, i) => {
    const p = `$.items[${i}]`;
    if (!entryIds.has(it.id)) out.push(`${p}.id: "${it.id}" is not in entries.json`);
    ["opens", "closes"].forEach((k) => { if (!isMonth(it[k])) out.push(`${p}.${k}: ${JSON.stringify(it[k])} is not null or 1 to 12`); });
    if (typeof it.quote !== "string" || !it.quote.trim()) out.push(`${p}.quote: empty`);
  });
  return out;
}

// ---- real data ----
const hubIds = L.HUBS.map((h) => h[0]);
const entryIds = new Set(loadJson("data/entries.json").map((e) => e.id));
const buildIso = loadJson("data/meta.json").checked;

test("meta.json has an ISO build date", () => {
  assert.ok(L.parseISO(buildIso), `meta.checked "${buildIso}" must be YYYY-MM-DD`);
});

const known = (file) => KNOWN_DEFECTS.filter((k) => k.file === file).map((k) => k.problem);

test("gaps.json shape (known defects listed, nothing else)", () => {
  assert.deepEqual(gapsProblems(loadJson("data/gaps.json"), hubIds), known("gaps.json"));
});

test("known defects are still real (delete the entry when the data is fixed)", () => {
  assert.deepEqual(gapsProblems(loadJson("data/gaps.json"), hubIds), known("gaps.json"));
  KNOWN_DEFECTS.forEach((k) => assert.ok(k.why));
});

test("calendar.json shape and ids", () => {
  assert.deepEqual(calendarProblems(loadJson("data/calendar.json"), entryIds, buildIso), []);
});

for (const f of AUX) {
  test(`${f}: no empty strings, https links only, unique ids`, () => {
    const d = loadJson(`data/${f}`);
    assert.deepEqual(emptyStrings(d), [], `${f} empty strings`);
    assert.deepEqual(badLinks(d), [], `${f} links`);
    assert.deepEqual(dupIds(d), [], `${f} duplicate ids`);
  });
}

test("every aux data file that carries a read date has a valid one not after the build date", () => {
  AUX.forEach((f) => {
    const d = loadJson(`data/${f}`);
    if (typeof d.read !== "string") return;
    const iso = readToIso(d.read);
    assert.ok(iso && L.parseISO(iso), `${f}: read "${d.read}" does not parse`);
    assert.ok(iso <= buildIso, `${f}: read ${iso} is after build date ${buildIso}`);
  });
});

test("program ids named in aux files exist in entries.json", () => {
  // Only calendar.json names programs by id; it is covered above. Guard that nothing else grows a program id list unchecked.
  const ref = AUX.filter((f) => f !== "calendar.json" && /"(programId|program_id|programs|entry_id)"\s*:/.test(fs.readFileSync(path.join(root, "data", f), "utf8")));
  assert.deepEqual(ref, [], "these files name programs: add an id check for them");
});

// ---- seeded-bad self-checks: each rule must fire ----
test("self-check: empty and space-only strings are caught", () => {
  assert.equal(emptyStrings({ a: ["ok", ""], b: { c: "   " } }).length, 2);
  assert.equal(emptyStrings({ label: "" }).length, 1);
  assert.deepEqual(emptyStrings({ numbers: [{ label: "" }] }), []);
});
test("self-check: http and non-https url fields are caught", () => {
  assert.equal(badLinks({ x: "http://a.com" }).length, 1);
  assert.equal(badLinks({ url: "/relative" }).length, 1);
  assert.equal(badLinks({ u: "http://a.com" }).length, 1);
  assert.equal(badLinks({ u: "javascript:x" }).length, 1);
  assert.deepEqual(badLinks({ u: "rules.html#permit" }), []);
  assert.equal(badLinks({ list: [{ u: "ftp://a" }] }).length, 1);
  assert.deepEqual(badLinks({ url: "https://a.com", p: "permit.html" }), []);
});
test("self-check: duplicate ids are caught", () => {
  assert.equal(dupIds({ rows: [{ id: "a" }, { id: "b" }, { id: "a" }] }).length, 1);
  assert.deepEqual(dupIds({ rows: [{ id: "a" }, { id: "b" }] }), []);
});
test("self-check: gaps rules fire", () => {
  const good = { id: "a", hubs: ["sv"], title: "T", text: "X", issue: 1 };
  assert.deepEqual(gapsProblems([good, { ...good, id: "b", issue: null }], hubIds), []);
  const bad = (patch) => gapsProblems([good, { ...good, id: "b", ...patch }], hubIds).length;
  assert.equal(bad({ id: "a" }), 1, "duplicate id");
  assert.equal(bad({ hubs: ["nowhere"] }), 1, "unknown hub");
  assert.equal(bad({ hubs: [] }), 1, "no hubs");
  assert.equal(bad({ issue: 0 }), 1, "issue zero");
  assert.equal(bad({ issue: 1.5 }), 1, "issue fraction");
  assert.equal(bad({ issue: "3" }), 1, "issue string");
  assert.equal(bad({ title: "" }), 1, "empty title");
  assert.equal(bad({ text: " pad" }), 1, "leading space");
  assert.equal(bad({ title: "pad " }), 1, "trailing space");
});
test("self-check: calendar rules fire", () => {
  const ids = new Set(["p1"]);
  const item = { id: "p1", opens: 1, closes: 12, quote: "q" };
  const cal = (patch, read = "Oct 9, 2026") => ({ read, items: [{ ...item, ...patch }] });
  assert.deepEqual(calendarProblems(cal({ opens: null }), ids, "2026-10-10"), []);
  const n = (c) => calendarProblems(c, ids, "2026-10-10").length;
  assert.equal(n(cal({ id: "typo" })), 1, "unknown id");
  assert.equal(n(cal({ opens: 13 })), 1, "month 13");
  assert.equal(n(cal({ closes: 0 })), 1, "month 0");
  assert.equal(n(cal({ closes: 3.5 })), 1, "fraction month");
  assert.equal(n(cal({ opens: "3" })), 1, "string month");
  assert.equal(n(cal({ quote: " " })), 1, "empty quote");
  assert.equal(n(cal({}, "Feb 30, 2026")), 1, "impossible read date");
  assert.equal(n(cal({}, "garbage")), 1, "unparseable read date");
  assert.equal(n(cal({}, "Oct 11, 2026")), 1, "read after build date");
});
