// Ticket r1-perf-scale-8: run tools/bench-matches.mjs and check that every scenario is printed and stays under a loose ceiling.
// The ceilings are about 6 to 10 times the worst median measured on 2026-10-10 (1,187 programs), so CI noise passes and a 10 times slowdown fails.
// The numbers themselves are for people to compare before and after a change. See docs/TESTING.md.
// Run with: node --test tests/r1-perf-scale-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "tools", "bench-matches.mjs");

// Every scenario the script must print. Keep this list in step with SCENARIOS in tools/bench-matches.mjs.
const EXPECTED = [
  "matches.empty",
  "matches.q1",
  "matches.q2",
  "matches.place",
  "matches.ageHubsFields",
  "sortList.best",
  "sortList.deadline",
  "sortList.name",
  "placeCounts",
  "parse.entries",
  "parse.lite",
  "parse.card",
  "parse.core",
];

// Ceilings in milliseconds, checked against the median. Scenario keys are matched by prefix.
const CEILINGS_MS = [
  ["matches.", 60],
  ["sortList.", 150],
  ["parse.", 120],
];

test("bench-matches runs and every scenario is under its ceiling", () => {
  const run = spawnSync(process.execPath, [SCRIPT, "--json", "--runs", "3"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120000,
  });
  assert.equal(run.status, 0, `tools/bench-matches.mjs exited ${run.status}\n${run.stderr}`);

  const out = JSON.parse(run.stdout);
  assert.equal(out.runs, 3, "the script should report the run count it was given");
  assert.ok(out.programs > 0, "the script should report a program count");

  for (const key of EXPECTED) {
    const s = out.scenarios[key];
    assert.ok(s, `scenario ${key} is missing from the output`);
    assert.equal(typeof s.median_ms, "number", `${key} has no median_ms`);
    assert.equal(typeof s.p95_ms, "number", `${key} has no p95_ms`);
    assert.ok(Number.isFinite(s.median_ms) && s.median_ms >= 0, `${key} median_ms is not a valid time: ${s.median_ms}`);
    assert.ok(Number.isFinite(s.p95_ms) && s.p95_ms >= 0, `${key} p95_ms is not a valid time: ${s.p95_ms}`);
  }

  for (const [prefix, ceiling] of CEILINGS_MS) {
    for (const key of EXPECTED.filter((k) => k.startsWith(prefix))) {
      const median = out.scenarios[key].median_ms;
      assert.ok(median < ceiling, `${key} median is ${median} ms, over the ceiling of ${ceiling} ms`);
    }
  }
});
