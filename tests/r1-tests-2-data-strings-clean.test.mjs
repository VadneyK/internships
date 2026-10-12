// r1-tests-2: every string value and object key in data/*.json is clean.
// Checks: U+2013 and U+2014 (dashes), U+00A0 (no-break space), U+200B to U+200D
// (zero-width characters), U+FEFF (byte order mark), runs of two or more spaces,
// and strings with leading or trailing whitespace. data/programs is covered by
// the program file checks, so it is not walked here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Each banned character, written as escapes so this file has no literal dash.
const BANNED = [
  ["\u2013", "U+2013 en dash"],
  ["\u2014", "U+2014 em dash"],
  [" ", "U+00A0 no-break space"],
  ["​", "U+200B zero-width space"],
  ["‌", "U+200C zero-width non-joiner"],
  ["‍", "U+200D zero-width joiner"],
  ["﻿", "U+FEFF byte order mark"],
];

// Known offenders that are kept on purpose. Each entry names the file, the JSON
// path, the problem text it must match, and why it stays. The test fails when an
// entry no longer matches a real problem, so the list cannot go stale.
// The repo is clean today, so the list is empty.
export const ALLOW = [];

// Problems in one parsed JSON value. Returns [{ path, problem }].
// Paths look like $.a.b[0] for values and $.a.<key> for object keys.
export function findProblems(value, path = "$", out = []) {
  if (Array.isArray(value)) {
    value.forEach((x, i) => findProblems(x, `${path}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const keyPath = `${path}.${key}`;
      for (const [ch, name] of BANNED) {
        if (key.includes(ch)) out.push({ path: keyPath, problem: `object key has ${name}` });
      }
      if (/ {2,}/.test(key)) out.push({ path: keyPath, problem: "object key has a run of 2 or more spaces" });
      if (key !== key.trim()) out.push({ path: keyPath, problem: "object key has leading or trailing whitespace" });
      findProblems(value[key], keyPath, out);
    }
  } else if (typeof value === "string") {
    for (const [ch, name] of BANNED) {
      if (value.includes(ch)) out.push({ path, problem: `string has ${name}` });
    }
    if (/ {2,}/.test(value)) out.push({ path, problem: "string has a run of 2 or more spaces" });
    if (value !== value.trim()) out.push({ path, problem: "string has leading or trailing whitespace" });
  }
  return out;
}

export const dataFiles = readdirSync(join(root, "data"))
  .filter((f) => f.endsWith(".json"))
  .sort();

// Checks every file against ALLOW. Returns { bad: [string], stale: [string] }.
export function checkFiles(files, allow = ALLOW, readJson) {
  const found = [];
  for (const file of files) {
    const data = readJson(file);
    for (const p of findProblems(data)) found.push({ file, ...p });
  }
  const used = new Set();
  const bad = [];
  for (const f of found) {
    const idx = allow.findIndex(
      (a) => a.file === f.file && a.path === f.path && f.problem.includes(a.problem),
    );
    if (idx >= 0) used.add(idx);
    else bad.push(`${f.file} ${f.path}: ${f.problem}`);
  }
  const stale = [];
  allow.forEach((a, i) => {
    if (!a.reason) stale.push(`${a.file} ${a.path}: allow-list entry has no reason`);
    else if (!used.has(i)) stale.push(`${a.file} ${a.path}: allow-list entry no longer matches a problem`);
  });
  return { bad, stale };
}

const readRepoJson = (file) => JSON.parse(readFileSync(join(root, "data", file), "utf8"));

test("negative control: each banned pattern is detected", () => {
  const sample = {
    ["a\u2013b"]: "x",
    dash: "a\u2014b",
    nbsp: "a b",
    zwsp: "a​b",
    zwnj: "a‌b",
    zwj: "a‍b",
    bom: "﻿a",
    double: "a  b",
    lead: " a",
    trail: "a ",
    list: ["ok", "b\u2013c"],
  };
  const problems = findProblems(sample).map((p) => p.problem);
  const want = [
    "object key has U+2013 en dash",
    "string has U+2014 em dash",
    "string has U+00A0 no-break space",
    "string has U+200B zero-width space",
    "string has U+200C zero-width non-joiner",
    "string has U+200D zero-width joiner",
    "string has U+FEFF byte order mark",
    "string has a run of 2 or more spaces",
    "string has leading or trailing whitespace",
  ];
  for (const w of want) assert.ok(problems.includes(w), `missing detection: ${w}`);
  const paths = findProblems(sample).map((p) => p.path);
  assert.ok(paths.includes("$.list[1]"), "array path is reported");
});

test("negative control: a stale allow-list entry is reported", () => {
  const { stale } = checkFiles(
    ["languages.json"],
    [{ file: "languages.json", path: "$.nope", problem: "string has U+2013 en dash", reason: "test" }],
    () => ({ ok: "clean" }),
  );
  assert.equal(stale.length, 1);
});

test("data/*.json strings and keys have no dashes, invisible characters, double spaces or untrimmed text", () => {
  assert.ok(dataFiles.length > 0, "no data json files found");
  const { bad, stale } = checkFiles(dataFiles, ALLOW, readRepoJson);
  assert.deepEqual(bad, [], `dirty data strings:\n${bad.join("\n")}`);
  assert.deepEqual(stale, [], `stale allow-list entries:\n${stale.join("\n")}`);
});
