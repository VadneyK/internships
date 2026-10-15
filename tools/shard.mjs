#!/usr/bin/env node
// Weight-balanced test sharding. Usage: node tools/shard.mjs <k> <n>
// Prints the test files for shard k of n (1-based), one per line.
// Files come from the real tests/*.test.mjs list on disk, so a new file is always run.
// Weights come from tests/test-weights.json (made by tools/time_tests.mjs); a file with
// no weight gets the median weight. Greedy longest-first bin packing, ties broken by
// file name, so the split is deterministic and every file lands in exactly one shard.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function listTestFiles(dir = join(root, "tests")) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".test.mjs"))
    .map((f) => `tests/${f}`)
    .sort();
}

export function loadWeights(path = join(root, "tests", "test-weights.json")) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8"));
}

function median(values) {
  if (!values.length) return 1;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Returns an array of n arrays of file names.
export function splitShards(files, weights, n) {
  const known = files.map((f) => weights[f]).filter((w) => Number.isFinite(w) && w > 0);
  const fallback = median(known);
  const weightOf = (f) => (Number.isFinite(weights[f]) && weights[f] > 0 ? weights[f] : fallback);
  const order = [...files].sort((a, b) => weightOf(b) - weightOf(a) || (a < b ? -1 : a > b ? 1 : 0));
  const shards = Array.from({ length: n }, () => ({ total: 0, files: [] }));
  for (const f of order) {
    let best = shards[0];
    for (const s of shards) if (s.total < best.total) best = s;
    best.files.push(f);
    best.total += weightOf(f);
  }
  return shards.map((s) => s.files.sort());
}

export function shardTotals(files, weights, n) {
  const known = files.map((f) => weights[f]).filter((w) => Number.isFinite(w) && w > 0);
  const fallback = median(known);
  return splitShards(files, weights, n).map((fs) =>
    fs.reduce((sum, f) => sum + (weights[f] > 0 ? weights[f] : fallback), 0),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const k = Number(process.argv[2]);
  const n = Number(process.argv[3]);
  if (!Number.isInteger(k) || !Number.isInteger(n) || n < 1 || k < 1 || k > n) {
    console.error("usage: node tools/shard.mjs <k> <n>   (1 <= k <= n)");
    process.exit(2);
  }
  const shards = splitShards(listTestFiles(), loadWeights(), n);
  // An empty shard would leave `node --test` with no file list, and then it runs the WHOLE suite. Print a name that
  // does not exist instead, so the job fails loudly. (Also when the usage is wrong above, the exit code is ignored by $(...).)
  const mine = shards[k - 1];
  process.stdout.write(mine.length ? mine.map((f) => f + "\n").join("") : "tests/EMPTY-SHARD-see-tools-shard.mjs\n");
}
