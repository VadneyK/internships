// Runs the date helpers in lib.js under several time zones, in child processes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const worker = fileURLToPath(new URL("./r1-tests-1-tzworker.mjs", import.meta.url));
const ZONES = ["UTC", "America/Los_Angeles", "America/New_York", "Pacific/Auckland", "Pacific/Kiritimati", "Asia/Kolkata"];

function run(tz) {
  const r = spawnSync(process.execPath, [worker], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
  assert.equal(r.status, 0, "worker failed under " + tz + ": " + r.stderr);
  return JSON.parse(r.stdout);
}

const results = {};
for (const tz of ZONES) results[tz] = run(tz);

test("expected values hold in the baseline zone", () => {
  const o = results.UTC;
  assert.deepEqual(o.roundTrip, ["2026-03-08", "2026-11-01"]);
  assert.deepEqual(o.addDays["2026-03-08"], ["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10", "2026-03-15", "2026-04-07"]);
  assert.deepEqual(o.addDays["2026-11-01"], ["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-08", "2026-12-01"]);
  assert.deepEqual(o.addDays["2026-03-07"], ["2026-03-08", "2026-03-09"]);
  assert.deepEqual(o.addDays["2026-10-31"], ["2026-11-01", "2026-11-02"]);
  assert.deepEqual(o.daysUntil["2026-03-08"], [3, 3]);
  assert.deepEqual(o.daysUntil["2026-11-01"], [3, 3]);
  assert.deepEqual(o.daysUntil["2026-03-08 same day"], [0, 0]);
  assert.deepEqual(o.daysUntil["2026-11-01 same day"], [0, 0]);
  for (const s of ["2026-03-08", "2026-11-01"]) {
    assert.deepEqual(o.effStatus[s], ["open-now", "open-now", "open-now"]);
    assert.equal(o.effStatus[s + " day after"], "closed-expect-reopen");
  }
});

for (const tz of ZONES) {
  test("same output in " + tz + " as in UTC", () => {
    assert.deepEqual(results[tz], results.UTC);
  });
}
