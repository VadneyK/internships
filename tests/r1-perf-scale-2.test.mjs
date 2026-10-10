// Run with: node --test tests/r1-perf-scale-2.test.mjs
// Checks data/entries-detail.json: the long text for opened cards, split out of entries.json.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const TOOLS = path.join(ROOT, "tools");
const DETAIL_FIELDS = ["who_can_apply", "how_to_apply", "notes"];
const GZIP_LIMIT = 330000;

function readText(file) {
  return fs.readFileSync(path.join(DATA, file), "utf8");
}

// Build into a scratch folder, so no other test file sees a half-written data file.
// build_data.py is the real build; only its output folder is changed.
function buildInto(outDir) {
  const code = "import sys; sys.path.insert(0, sys.argv[1]); import build_data; build_data.OUT_DIR = sys.argv[2]; sys.exit(build_data.main())";
  execFileSync("python3", ["-c", code, TOOLS, outDir], { cwd: ROOT, stdio: "pipe" });
  return fs.readFileSync(path.join(outDir, "entries-detail.json"));
}

const committedBytes = fs.readFileSync(path.join(DATA, "entries-detail.json"));
const detail = JSON.parse(committedBytes.toString("utf8"));
const entries = JSON.parse(readText("entries.json"));
const lite = JSON.parse(readText("entries-lite.json"));

let scratch = [];
let builds = [];

before(() => {
  for (let i = 0; i < 2; i += 1) {
    scratch.push(fs.mkdtempSync(path.join(os.tmpdir(), "entries-detail-")));
  }
  builds = scratch.map((dir) => buildInto(dir));
});

after(() => {
  for (const dir of scratch) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("entries-detail.json has the same ids in the same order as entries.json", () => {
  assert.equal(detail.length, entries.length);
  assert.deepEqual(
    detail.map((row) => row.id),
    entries.map((row) => row.id),
  );
  assert.deepEqual(
    lite.map((row) => row.id),
    entries.map((row) => row.id),
  );
});

test("lite row plus detail row equals the entries.json row minus sources_fetched, for every program", () => {
  entries.forEach((entry, i) => {
    const { sources_fetched: _unused, ...expected } = entry;
    const merged = { ...lite[i], ...detail[i] };
    assert.deepStrictEqual(merged, expected, `program ${entry.id}`);
  });
});

test("each detail row holds only id plus the long text fields that program has", () => {
  const allowed = new Set(["id", ...DETAIL_FIELDS]);
  entries.forEach((entry, i) => {
    const row = detail[i];
    for (const key of Object.keys(row)) {
      assert.ok(allowed.has(key), `${entry.id} has unexpected key ${key}`);
    }
    for (const field of DETAIL_FIELDS) {
      assert.equal(field in row, field in entry, `${entry.id} presence of ${field}`);
    }
  });
});

test("entries-detail.json gzips to at most 330,000 bytes", () => {
  const gz = zlib.gzipSync(committedBytes, { level: 9 });
  assert.ok(gz.length <= GZIP_LIMIT, `gzipped size ${gz.length} is over ${GZIP_LIMIT}`);
});

test("build_data.py writes the committed entries-detail.json, byte for byte", () => {
  assert.ok(builds[0].equals(committedBytes), "run python3 tools/build_data.py and commit data/entries-detail.json");
});

test("running build_data.py twice gives byte-identical entries-detail.json", () => {
  assert.ok(builds[0].equals(builds[1]));
});
