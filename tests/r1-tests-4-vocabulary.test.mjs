// Every program's type, fields, paid_type, regions, status and season must use a value
// that assets/js/lib.js knows about. A value lib.js does not know would show as a raw key
// or fall out of every filter chip and count.
// Run with: node --test tests/r1-tests-4-vocabulary.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const PROGRAMS = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const NOW = new Date(2026, 9, 10).getTime(); // fixed so results never drift

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
// Season ids come from lib.insights (the season chart), not a copy kept in this file.
const SEASONS = L.insights([], NOW).seasons.map((s) => s.id);
const REGION_IDS = new Set(L.REGIONS.map((r) => r[0]));
// Every paid_type must have a label and must belong to a paid filter group, or it falls out of every chip.
const PAID_IN_GROUP = new Set(L.PAID_GROUPS.flatMap((g) => g[2]));

// Returns one string per bad value, each naming the program id and the bad value.
function problemsFor(p) {
  const out = [];
  const add = (field, value) => out.push(`${p.id}: ${field} "${value}" is not in lib.js`);
  if (!hasOwn(L.TYPES, p.type)) add("type", p.type);
  for (const f of p.fields || []) if (f !== "any" && !hasOwn(L.FIELDS, f)) add("fields", f);
  if (!hasOwn(L.PAID, p.paid_type) || !PAID_IN_GROUP.has(p.paid_type)) add("paid_type", p.paid_type);
  for (const r of p.regions || []) if (!REGION_IDS.has(r)) add("regions", r);
  // lib.STATUSES holds the outreach-plan statuses, not program statuses. Program statuses are
  // the STATUS_GROUPS in lib.js, which only show up through insights. A known status lands in
  // exactly one group, so the group counts for this one program add up to 1.
  if (L.insights([p], NOW).status.reduce((n, g) => n + g.n, 0) !== 1) add("status", p.status);
  if (p.season != null && !SEASONS.includes(p.season)) add("season", p.season);
  return out;
}

test("data/entries.json has programs to check", () => {
  assert.ok(PROGRAMS.length > 0);
});

test("lib.js season ids are the six season ids used by the insights chart", () => {
  assert.deepEqual(SEASONS.slice().sort(), ["fall", "spring", "school-year", "summer", "winter", "year-round"].sort());
});

test("every program uses only known type, fields, paid_type, regions, status and season values", () => {
  const problems = PROGRAMS.flatMap(problemsFor);
  assert.deepEqual(problems, [], `Unknown vocabulary values:\n${problems.join("\n")}`);
});

test("the checker flags bad values (self-check so a silent checker cannot pass)", () => {
  const problems = problemsFor({
    id: "bad-row", type: "nope", fields: ["nope", "any"], paid_type: "nope",
    regions: ["nowhere"], status: "nope", season: "monsoon"
  });
  assert.equal(problems.length, 6);
  for (const line of problems) assert.match(line, /^bad-row: /);
});
