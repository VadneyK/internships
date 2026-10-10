import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-data-content-1.
// The Tech Interactive Holiday Helper card. On Oct 9, 2026 the official volunteer page no
// longer shows the Oct 9 to Oct 23, 2026 application window, so the card is unconfirmed
// rather than open-now. This test pins what the page supports and checks that the
// entries.json copy matches the program file.

const PROGRAM = JSON.parse(
  fs.readFileSync(
    new URL("../data/programs/tech-interactive-teen-holiday-helper.json", import.meta.url),
    "utf8",
  ),
);
const ENTRIES = JSON.parse(
  fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"),
);
const RAW = fs.readFileSync(
  new URL("../data/programs/tech-interactive-teen-holiday-helper.json", import.meta.url),
  "utf8",
);
const entry = ENTRIES.find((e) => e.id === PROGRAM.id);

test("program card exists in entries.json", () => {
  assert.ok(entry, "no entries.json record for tech-interactive-teen-holiday-helper");
});

test("status is unconfirmed, not open-now, because the page shows no window", () => {
  assert.equal(PROGRAM.status, "unconfirmed");
  assert.equal(PROGRAM.opens_iso, null);
  assert.equal(PROGRAM.deadline_iso, null);
  assert.equal(PROGRAM.deadline_confidence, "unknown");
});

test("the Oct 23 window is not claimed anywhere on the card", () => {
  assert.ok(!PROGRAM.deadline_text.includes("Oct 23"));
  assert.ok(!PROGRAM.deadline_text.includes("Oct 9 to"));
});

test("min_age matches the official page rule: 14 or older by Nov 21, 2026", () => {
  assert.equal(PROGRAM.min_age, 14);
  assert.equal(PROGRAM.max_age, null);
  assert.match(PROGRAM.who_can_apply, /14 or older by Nov 21, 2026/);
});

test("verified_on is the day the official page was re-read", () => {
  assert.equal(PROGRAM.verified, "fetched");
  assert.equal(PROGRAM.verified_on, "2026-10-09");
});

test("entries.json copy matches the program file on every field", () => {
  const mismatches = [];
  for (const [key, value] of Object.entries(PROGRAM)) {
    if (JSON.stringify(entry[key]) !== JSON.stringify(value)) {
      mismatches.push(`${key}: program ${JSON.stringify(value)} vs entries ${JSON.stringify(entry[key])}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

test("program file has no em dash or en dash characters", () => {
  assert.ok(!/[\u2013\u2014]/.test(RAW), "dash character found in program file");
});
