// r1-tests-6: every program file matches data/schema/program.schema.json, and
// entries.json, entries.csv and the entries-*.json projections stay in step
// with data/programs. Hand written checks only, no dependencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const schema = readJson("data/schema/program.schema.json");
const files = readdirSync(join(root, "data/programs")).filter((f) => f.endsWith(".json")).sort();
const programs = files.map((f) => ({ file: f, data: readJson("data/programs/" + f) }));

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

// Checks the subset of JSON Schema keywords the program schema uses.
function check(value, rule, path, errs) {
  if (rule.enum) {
    if (!rule.enum.includes(value)) errs.push(`${path}: ${JSON.stringify(value)} not in enum`);
    return;
  }
  if (rule.type) {
    const allowed = [].concat(rule.type);
    const t = typeOf(value);
    const ok = allowed.includes(t) || (t === "integer" && allowed.includes("number"));
    if (!ok) { errs.push(`${path}: type ${t}, wanted ${allowed.join("|")}`); return; }
  }
  if (typeof value === "string") {
    if (rule.minLength != null && value.length < rule.minLength) errs.push(`${path}: shorter than ${rule.minLength}`);
    if (rule.maxLength != null && value.length > rule.maxLength) errs.push(`${path}: longer than ${rule.maxLength}`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) errs.push(`${path}: does not match ${rule.pattern}`);
  }
  if (typeof value === "number") {
    if (rule.minimum != null && value < rule.minimum) errs.push(`${path}: below ${rule.minimum}`);
    if (rule.maximum != null && value > rule.maximum) errs.push(`${path}: above ${rule.maximum}`);
  }
  if (Array.isArray(value)) {
    if (rule.minItems != null && value.length < rule.minItems) errs.push(`${path}: fewer than ${rule.minItems} items`);
    if (rule.uniqueItems && new Set(value.map((x) => JSON.stringify(x))).size !== value.length) errs.push(`${path}: duplicate items`);
    if (rule.items) value.forEach((x, i) => check(x, rule.items, `${path}[${i}]`, errs));
  }
}

function validate(obj) {
  const errs = [];
  for (const k of schema.required) if (!(k in obj)) errs.push(`missing required key ${k}`);
  if (schema.additionalProperties === false) {
    for (const k of Object.keys(obj)) if (!(k in schema.properties)) errs.push(`unknown key ${k}`);
  }
  for (const [k, rule] of Object.entries(schema.properties)) {
    if (k in obj) check(obj[k], rule, k, errs);
  }
  return errs;
}

test("schema declares the keys and enums this test relies on", () => {
  assert.ok(schema.required.length > 0);
  for (const k of ["type", "paid_type", "status", "season", "deadline_confidence"]) {
    assert.ok(schema.required.includes(k), `${k} should be required`);
    assert.ok(Array.isArray(schema.properties[k].enum), `${k} should be an enum`);
  }
});

test("there is at least one program file", () => {
  assert.ok(files.length > 0);
});

test("every program file parses, matches the schema and has id equal to its file name", () => {
  const bad = [];
  for (const { file, data } of programs) {
    const errs = validate(data);
    if (data.id !== file.replace(/\.json$/, "")) errs.push(`id ${data.id} does not match file name`);
    if (errs.length) bad.push(`${file}: ${errs.join("; ")}`);
  }
  assert.deepEqual(bad.slice(0, 20), [], `${bad.length} program files fail`);
});

const entries = readJson("data/entries.json");
const entryIds = entries.map((e) => e.id);

test("entries.json ids are unique and equal the data/programs set", () => {
  assert.equal(new Set(entryIds).size, entryIds.length, "duplicate ids in entries.json");
  assert.deepEqual([...entryIds].sort(), programs.map((p) => p.data.id).sort());
});

test("entries.json rows agree with their program files", () => {
  const byId = new Map(programs.map((p) => [p.data.id, p.data]));
  const bad = [];
  for (const e of entries) {
    const p = byId.get(e.id);
    for (const k of ["type", "paid_type", "status", "season", "deadline_confidence", "deadline_iso", "url"]) {
      if (JSON.stringify(e[k]) !== JSON.stringify(p[k])) bad.push(`${e.id}.${k}`);
    }
  }
  assert.deepEqual(bad.slice(0, 20), [], `${bad.length} fields differ`);
});

for (const name of ["lite", "stats", "core", "detail", "home"]) {
  test(`entries-${name}.json has the same ids in the same order as entries.json`, () => {
    const rows = readJson(`data/entries-${name}.json`);
    assert.ok(Array.isArray(rows));
    assert.deepEqual(rows.map((r) => r.id), entryIds);
  });
}

// Small CSV reader: handles quoted fields, doubled quotes and newlines in quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = ""; rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

test("entries.csv has one row per entry, same ids in the same order", () => {
  const rows = parseCsv(readFileSync(join(root, "data/entries.csv"), "utf8"));
  const header = rows[0];
  assert.equal(header[0], "id");
  const body = rows.slice(1);
  for (const r of body) assert.equal(r.length, header.length, `bad column count for ${r[0]}`);
  assert.deepEqual(body.map((r) => r[0]), entryIds);
});
