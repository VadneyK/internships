// The weight-balanced test splitter (tools/shard.mjs) must run every test file exactly once.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { listTestFiles, loadWeights, splitShards, shardTotals } from "../tools/shard.mjs";

const files = listTestFiles();
const weights = loadWeights();

function cli(k, n) {
  const out = execFileSync(process.execPath, ["tools/shard.mjs", String(k), String(n)], { encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

test("for n in 1..8 the shards together are the full file list, each file once", () => {
  for (let n = 1; n <= 8; n += 1) {
    const all = [];
    for (let k = 1; k <= n; k += 1) all.push(...cli(k, n));
    assert.equal(all.length, files.length, `n=${n}: count differs`);
    assert.equal(new Set(all).size, all.length, `n=${n}: a file appears twice`);
    assert.deepEqual([...all].sort(), files, `n=${n}: union differs from tests/*.test.mjs`);
  }
});

test("the split is deterministic", () => {
  for (const n of [1, 3, 6, 8]) {
    assert.deepEqual(splitShards(files, weights, n), splitShards([...files].reverse(), weights, n));
    assert.deepEqual(cli(2 <= n ? 2 : 1, n), cli(2 <= n ? 2 : 1, n));
  }
});

test("a file missing from the weights still gets assigned, once", () => {
  const extra = [...files, "tests/brand-new-file.test.mjs"];
  const shards = splitShards(extra, weights, 6);
  const all = shards.flat();
  assert.equal(all.filter((f) => f === "tests/brand-new-file.test.mjs").length, 1);
  assert.equal(all.length, extra.length);
  assert.equal(new Set(all).size, extra.length);
});

test("with the real weights the largest shard is within 25 percent of the mean", () => {
  const totals = shardTotals(files, weights, 6);
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  assert.ok(Math.max(...totals) <= mean * 1.25, `shard totals ${totals.join(", ")} (mean ${Math.round(mean)})`);
});

// 2026-10-15: more shards than files must not print an empty list (node --test would then run every file).
test("an empty shard prints a missing file name so CI fails loudly", async () => {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(process.execPath, ["tools/shard.mjs", "700", "700"], { encoding: "utf8" });
  assert.equal(out, "tests/EMPTY-SHARD-see-tools-shard.mjs\n");
});
