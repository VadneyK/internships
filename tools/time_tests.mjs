#!/usr/bin/env node
// Measures wall time per test file (each run alone) and writes tests/test-weights.json.
// Usage: node tools/time_tests.mjs [parallelism=4]
// Rerun now and then so tools/shard.mjs keeps the shards balanced.
import { spawn } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const parallel = Number(process.argv[2]) || 4;
const files = readdirSync(join(root, "tests"))
  .filter((f) => f.endsWith(".test.mjs"))
  .sort()
  .map((f) => `tests/${f}`);

const weights = {};
let next = 0;
let done = 0;

function runOne(file) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(process.execPath, ["--test", file], { cwd: root, stdio: "ignore" });
    child.on("close", () => {
      weights[file] = Date.now() - start;
      done += 1;
      if (done % 50 === 0) console.error(`${done}/${files.length}`);
      resolve();
    });
  });
}

async function worker() {
  while (next < files.length) {
    const file = files[next++];
    await runOne(file);
  }
}

await Promise.all(Array.from({ length: parallel }, worker));
const sorted = Object.fromEntries(Object.keys(weights).sort().map((k) => [k, weights[k]]));
writeFileSync(join(root, "tests", "test-weights.json"), JSON.stringify(sorted, null, 2) + "\n");
console.error(`wrote ${files.length} weights`);
