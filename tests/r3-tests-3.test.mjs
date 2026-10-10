// Keeps lib.js labels, the schema enums and the Find menus in step.
// A new schema value with no label would show as a raw id; a menu value lib.matches does not know would filter nothing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const L = require(path.join(ROOT, "assets/js/lib.js"));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const schema = JSON.parse(read("data/schema/program.schema.json"));
const entries = JSON.parse(read("data/entries.json"));
const P = schema.properties;
const NOW = new Date(2026, 9, 9);

const sorted = (a) => [...a].sort();
const sameSet = (actual, expected, what) => assert.deepEqual(sorted(actual), sorted(expected), what);

function selectOptions(file, id) {
  const doc = new JSDOM(read(file)).window.document;
  const sel = doc.getElementById(id);
  if (!sel) return null;
  return [...sel.querySelectorAll("option")].map((o) => o.getAttribute("value") ?? o.textContent.trim());
}

test("schema enums are present and non-empty", () => {
  for (const k of ["type", "paid_type", "season", "status"]) assert.ok(P[k].enum.length > 0, k);
  assert.ok(P.regions.items.enum.length > 0);
  assert.ok(P.fields.items.enum.length > 0);
  assert.ok(Array.isArray(entries) && entries.length > 0);
});

test("regions: schema and L.REGIONS match both ways, no duplicate ids or empty labels", () => {
  const ids = L.REGIONS.map((r) => r[0]);
  sameSet(ids, P.regions.items.enum, "REGIONS ids vs schema regions");
  assert.equal(new Set(ids).size, ids.length, "duplicate region id");
  for (const r of L.REGIONS) assert.ok(r[1] && r[1].trim(), "empty label for " + r[0]);
});

test("types, fields and paid types: schema and lib.js labels match both ways", () => {
  sameSet(Object.keys(L.TYPES), P.type.enum, "TYPES vs schema type");
  sameSet(Object.keys(L.FIELDS), P.fields.items.enum, "FIELDS vs schema fields");
  sameSet(Object.keys(L.PAID), P.paid_type.enum, "PAID vs schema paid_type");
  for (const m of [L.TYPES, L.FIELDS, L.PAID]) for (const [k, v] of Object.entries(m)) assert.ok(v && v.trim(), "empty label for " + k);
});

test("PAID_GROUPS: every member is a paid_type and every paid_type is in exactly one group", () => {
  const all = P.paid_type.enum;
  for (const g of L.PAID_GROUPS) for (const m of g[2]) assert.ok(all.includes(m), g[0] + " has unknown paid type " + m);
  for (const p of all) {
    const n = L.PAID_GROUPS.filter((g) => g[2].includes(p)).length;
    assert.equal(n, 1, p + " is in " + n + " groups");
  }
  const gids = L.PAID_GROUPS.map((g) => g[0]);
  assert.equal(new Set(gids).size, gids.length, "duplicate group id");
});

test("every region is in at least one hub, and every hub region exists", () => {
  const known = new Set(P.regions.items.enum);
  const inHub = new Set();
  for (const h of L.HUBS) for (const r of h[2]) { assert.ok(known.has(r), h[0] + " lists unknown region " + r); inHub.add(r); }
  const missing = P.regions.items.enum.filter((r) => !inHub.has(r));
  assert.deepEqual(missing, [], "regions with no hub");
});

const fake = (o) => Object.assign({ id: "x", name: "X", type: "internship", paid_type: "paid", fields: ["any"], regions: ["davis"], status: "rolling", season: "summer" }, o);

test("every schema season has a label in insights().seasons and counts one card", () => {
  const out = L.insights(P.season.enum.map((s, i) => fake({ id: "s" + i, season: s })), NOW);
  const byId = Object.fromEntries(out.seasons.map((s) => [s.id, s]));
  sameSet(Object.keys(byId), P.season.enum, "insights seasons vs schema seasons");
  for (const s of P.season.enum) { assert.ok(byId[s].label && byId[s].label.trim(), s + " has no label"); assert.equal(byId[s].n, 1, s + " not counted"); }
});

test("every schema status is handled by effStatus and lands in exactly one insights status group", () => {
  for (const st of P.status.enum) {
    const e = fake({ id: "st", status: st });
    let got;
    assert.doesNotThrow(() => { got = L.effStatus(e, NOW); }, st);
    assert.ok(P.status.enum.includes(got), st + " became unknown status " + got);
    const out = L.insights([e], NOW);
    const hit = out.status.filter((g) => g.n > 0);
    assert.equal(hit.length, 1, st + " is in " + hit.length + " status groups (none means it is dropped from the chart)");
    assert.equal(hit[0].n, 1);
  }
  // With dates attached, stale open statuses must still map to a schema status.
  for (const st of ["open-now", "opens-soon"]) {
    const got = L.effStatus(fake({ status: st, deadline_iso: "2026-01-01", opens_iso: "2025-12-01" }), NOW);
    assert.ok(P.status.enum.includes(got), got);
  }
});

test("find.html menus: season values are schema seasons (or the empty default) and filter something", () => {
  const vals = selectOptions("src/find.html", "season");
  assert.ok(vals && vals.length > 1, "season select missing");
  assert.ok(vals.includes(""), "season needs an any-season default");
  sameSet(vals.filter(Boolean), P.season.enum, "season menu vs schema seasons");
  for (const v of vals.filter(Boolean)) {
    const n = entries.filter((e) => L.matches(e, { season: v }, NOW)).length;
    assert.ok(n > 0, "season " + v + " matches nothing");
  }
  const strict = entries.filter((e) => L.matches(e, { season: "summer" }, NOW)).length;
  assert.ok(strict < entries.length, "season filter does not narrow anything");
});

test("find.html menus: every when value changes matches() or is the empty default", () => {
  const vals = selectOptions("src/find.html", "when");
  assert.ok(vals && vals.includes(""), "when needs an empty default");
  const base = entries.filter((e) => L.matches(e, {}, NOW)).length;
  assert.equal(base, entries.length);
  for (const v of vals.filter(Boolean)) {
    const n = entries.filter((e) => L.matches(e, { when: v }, NOW)).length;
    assert.ok(n < base, "when=" + v + " filters nothing (unknown value?)");
    assert.ok(n > 0, "when=" + v + " matches no real card");
  }
});

test("find.html menus: every sort value is a mode sortList accepts and changes the order", () => {
  const vals = selectOptions("src/find.html", "sort");
  assert.ok(vals && vals.length >= 2, "sort select missing");
  const ids = (m) => L.sortList(entries, m, NOW).map((e) => e.id).join("|");
  const fallback = ids("__not_a_mode__"); // sortList treats unknown modes as "best"
  assert.equal(ids("best"), fallback);
  for (const v of vals) {
    assert.ok(v, "sort option needs a value");
    assert.equal(L.sortList(entries, v, NOW).length, entries.length, v + " changed the list length");
    if (v !== "best") assert.notEqual(ids(v), fallback, "sort=" + v + " gives the same order as the default");
  }
  assert.ok(vals.includes("best"), "sort needs the best mode");
});

test("index.html has no season, when or sort menus that could drift (checked if added)", () => {
  for (const id of ["season", "when", "sort"]) {
    const vals = selectOptions("src/index.html", id);
    if (!vals) continue;
    if (id === "season") for (const v of vals.filter(Boolean)) assert.ok(P.season.enum.includes(v), "index season " + v);
    if (id === "when") for (const v of vals.filter(Boolean)) assert.ok(entries.filter((e) => L.matches(e, { when: v }, NOW)).length < entries.length, "index when " + v);
    if (id === "sort") for (const v of vals) assert.ok(["best", "deadline", "name"].includes(v), "index sort " + v);
  }
});

test("no dead filter options: every type and field has a card in entries.json", () => {
  const types = new Set(entries.map((e) => e.type));
  const fields = new Set(entries.flatMap((e) => e.fields || []));
  for (const t of Object.keys(L.TYPES)) assert.ok(types.has(t), "type " + t + " has no card");
  for (const f of Object.keys(L.FIELDS)) assert.ok(fields.has(f), "field " + f + " has no card");
  for (const e of entries) {
    assert.ok(L.TYPES[e.type], e.id + " has unlabeled type " + e.type);
    for (const f of e.fields || []) assert.ok(L.FIELDS[f], e.id + " has unlabeled field " + f);
    assert.ok(L.PAID[e.paid_type], e.id + " has unlabeled paid_type " + e.paid_type);
  }
});
