// Run with: node --test tests/r2-tests-8-w2-status-confidence-matrix.test.mjs
// Checks every (status, deadline_confidence) pair in data/entries.json against one table.
// Cards that break the table are listed by id on ALLOW_LIST with a reason. No DOM, reads the JSON file only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONFIDENCE_DATED = ["confirmed-2026-27", "last-year-pattern", "unknown"];
const ALLOWED = {
  "open-now": CONFIDENCE_DATED,
  "opens-soon": CONFIDENCE_DATED,
  "event": CONFIDENCE_DATED,
  "closed-expect-reopen": CONFIDENCE_DATED,
  "rolling": ["rolling", "unknown", "last-year-pattern"],
  "year-round": ["rolling", "unknown", "last-year-pattern"],
  "unconfirmed": ["unknown", "last-year-pattern"],
};

// Cards that break the table today. Each entry pins the exact pair it was reviewed with.
const ALLOW_LIST = {
  "baltimore-wide-angle-high-school-media-classes": { status: "closed-expect-reopen", deadline_confidence: "rolling", reason: "Closed card with rolling confidence, which never expires. Fix the card." },
  "pasadena-city-college-concurrent-dual-enrollment": { status: "closed-expect-reopen", deadline_confidence: "rolling", reason: "Closed card with rolling confidence, which never expires. Fix the card." },
  "santa-barbara-humane-society-volunteers": { status: "closed-expect-reopen", deadline_confidence: "rolling", reason: "Closed card with rolling confidence, which never expires. Fix the card." },
  "boston-futurebos-youth-jobs": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "bullock-museum-volunteer": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "college-park-urban-forestry-careers-camp": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "el-camino-college-dual-enrollment": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "nyc-brooklyn-bridge-park-green-team-coastal-cleanup": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "phoenix-azyouthforce-paid-internships": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "salem-oregon-humane-youth-volunteer": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "uc-scout": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "yolo-4h": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "columbus-upper-arlington-library-teen-volunteers": { status: "rolling", deadline_confidence: "confirmed-2026-27", reason: "Rolling status with a confirmed 2026-27 date. The table does not allow this pair yet." },
  "lafayette-purdue-saturday-morning-astrophysics": { status: "rolling", deadline_confidence: "confirmed-2026-27", reason: "Rolling status with a confirmed 2026-27 date. The table does not allow this pair yet." },
  "nc-ffa-association": { status: "rolling", deadline_confidence: "confirmed-2026-27", reason: "Rolling status with a confirmed 2026-27 date. The table does not allow this pair yet." },
  "new-brunswick-franklin-township-library-teen-volunteering": { status: "rolling", deadline_confidence: "confirmed-2026-27", reason: "Rolling status with a confirmed 2026-27 date. The table does not allow this pair yet." },
  "la-county-youth-at-work": { status: "unconfirmed", deadline_confidence: "rolling", reason: "Unconfirmed with rolling confidence. The page says no deadline is posted." },
  "imsa-rise-online-research-program": { status: "unconfirmed", deadline_confidence: "confirmed-2026-27", reason: "Unconfirmed status, but the text gives dates. Confirm the status or the confidence." },
  "newport-oregon-coast-aquarium-youth-volunteer": { status: "unconfirmed", deadline_confidence: "confirmed-2026-27", reason: "Unconfirmed status, but the text gives dates. Confirm the status or the confidence." },
  "twin-cities-juxtaposition-arts-valt-drawing": { status: "unconfirmed", deadline_confidence: "confirmed-2026-27", reason: "Unconfirmed status, but the text gives dates. Confirm the status or the confidence." },
  "vancouver-ubc-future-global-leaders": { status: "unconfirmed", deadline_confidence: "confirmed-2026-27", reason: "Unconfirmed status, but the text gives dates. Confirm the status or the confidence." },
  "philadelphia-fleisher-teen-lounge": { status: "year-round", deadline_confidence: "confirmed-2026-27", reason: "Year-round status with confirmed 2026-27 dates. Pick one status or the other." },
  "stock-market-game-sifma-foundation": { status: "open-now", deadline_confidence: "rolling", reason: "Open with no closing date. The table does not allow open-now with rolling yet." },
  "illinois-fbla-state-association": { status: "rolling", deadline_confidence: "confirmed-2026-27", reason: "Rolling status with a confirmed 2026-27 date. The table does not allow this pair yet." },
  "nyit-high-school-business-bootcamp": { status: "rolling", deadline_confidence: "confirmed-2026-27", reason: "Rolling status with a confirmed 2026-27 date. The table does not allow this pair yet." },
  "hawaii-4h-cooperative-extension": { status: "year-round", deadline_confidence: "confirmed-2026-27", reason: "Year-round status with confirmed 2026-27 dates. Pick one status or the other." },
  "pennsylvania-pseas-school-for-excellence-agricultural-sciences": { status: "unconfirmed", deadline_confidence: "confirmed-2026-27", reason: "Unconfirmed status, but the text gives dates. Confirm the status or the confidence." },
};

// Returns a list of failure messages. An empty list means the entries pass.
export function checkPairs(entries, allowList) {
  const failures = [];
  const ids = new Set(entries.map((e) => e.id));

  for (const e of entries) {
    const pairAllowed = (ALLOWED[e.status] || []).includes(e.deadline_confidence);
    const listed = allowList[e.id];
    if (pairAllowed) {
      if (listed) failures.push(`${e.id}: stale allow-list entry, ${e.status} + ${e.deadline_confidence} is now allowed; remove it`);
      continue;
    }
    if (!listed) {
      failures.push(`${e.id}: ${e.status} + ${e.deadline_confidence} is not allowed by the table`);
      continue;
    }
    if (listed.status !== e.status || listed.deadline_confidence !== e.deadline_confidence) {
      failures.push(`${e.id}: pair changed to ${e.status} + ${e.deadline_confidence}; re-check its allow-list entry`);
    }
  }

  for (const id of Object.keys(allowList)) {
    if (!ids.has(id)) failures.push(`${id}: allow-list entry has no card with this id; remove it`);
  }
  return failures;
}

const realEntries = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "entries.json"), "utf8"));

test("every card pair in data/entries.json is allowed or on the allow-list", () => {
  assert.deepEqual(checkPairs(realEntries, ALLOW_LIST), []);
});

test("every allow-list entry has a one-line reason", () => {
  for (const [id, entry] of Object.entries(ALLOW_LIST)) {
    assert.ok(typeof entry.reason === "string" && entry.reason.trim().length > 0, `${id} needs a reason`);
    assert.ok(!/[\r\n]/.test(entry.reason), `${id} reason must be one line`);
  }
});

test("fixture: a made-up bad pair is caught with its card id", () => {
  const fixture = [
    { id: "fixture-closed-rolling", status: "closed-expect-reopen", deadline_confidence: "rolling" },
    { id: "fixture-good-open", status: "open-now", deadline_confidence: "confirmed-2026-27" },
    { id: "fixture-unknown-status", status: "paused", deadline_confidence: "unknown" },
  ];
  const failures = checkPairs(fixture, {});
  assert.equal(failures.length, 2);
  assert.ok(failures.some((f) => f.startsWith("fixture-closed-rolling:")));
  assert.ok(failures.some((f) => f.startsWith("fixture-unknown-status:")));
  assert.ok(!failures.some((f) => f.startsWith("fixture-good-open:")));
});

test("fixture: a stale allow-list entry fails, both for a missing id and for an allowed pair", () => {
  const fixture = [{ id: "fixture-open", status: "open-now", deadline_confidence: "unknown" }];
  const failures = checkPairs(fixture, {
    "fixture-missing": { status: "closed-expect-reopen", deadline_confidence: "rolling", reason: "x" },
    "fixture-open": { status: "open-now", deadline_confidence: "unknown", reason: "x" },
  });
  assert.ok(failures.some((f) => f.startsWith("fixture-missing:")));
  assert.ok(failures.some((f) => f.startsWith("fixture-open:") && f.includes("stale")));
});
