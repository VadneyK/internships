// r1-tests-6 (boundary table): exact edges that the broad clock sweep and age-field tests do not pin.
// Covers: ageOk at min_age and max_age and one off (11, 12, 18, 19), with null limits and equal limits;
// effStatus and futureDeadline for a deadline that is yesterday, today or tomorrow, at local noon and 23:59,
// on the days around the US spring and fall clock changes; daysUntil returns whole numbers across those days;
// malformed deadline_iso values give no deadline and never throw.
// Synthetic entries only. No data files, no network, no real clock.
// Each zone is set in turn through process.env.TZ (Node applies a runtime change), then restored.
// Every expected value sits in its row with a short reason. A failure names the zone, the row and the reason.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const L = createRequire(import.meta.url)("../assets/js/lib.js");

const ZONES = ["America/New_York", "Pacific/Auckland"];

function inZone(tz, fn) {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

// Local Date at a wall-clock time on an ISO day.
function localAt(isoDay, hh, mm) {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0);
}

// Each row: [age-limit row] min_age, max_age, age, expected ageOk, reason.
const AGE_ROWS = [
  [null, null, 11, true, "no min or max set, so every age passes"],
  [null, null, 12, true, "no min or max set, so every age passes"],
  [null, null, 18, true, "no min or max set, so every age passes"],
  [null, null, 19, true, "no min or max set, so every age passes"],
  [12, null, 11, false, "one under min_age 12"],
  [12, null, 12, true, "exactly min_age 12"],
  [12, null, 18, true, "no max_age, so an older teen passes"],
  [12, null, 19, true, "no max_age, so an adult passes"],
  [null, 18, 11, true, "no min_age, so a younger teen passes"],
  [null, 18, 12, true, "no min_age, so a younger teen passes"],
  [null, 18, 18, true, "exactly max_age 18"],
  [null, 18, 19, false, "one over max_age 18"],
  [12, 18, 11, false, "one under min_age 12"],
  [12, 18, 12, true, "exactly min_age 12"],
  [12, 18, 13, true, "inside the 12 to 18 range"],
  [12, 18, 17, true, "inside the 12 to 18 range"],
  [12, 18, 18, true, "exactly max_age 18"],
  [12, 18, 19, false, "one over max_age 18"],
  [13, 13, 12, false, "equal limits: one under 13"],
  [13, 13, 13, true, "equal limits: exactly 13"],
  [13, 13, 14, false, "equal limits: one over 13"],
  [19, 18, 18, false, "min above max matches nothing (18 is under min 19)"],
  [19, 18, 19, false, "min above max matches nothing (19 is over max 18)"],
];

test("ageOk: min_age and max_age edges and one off", () => {
  for (const [min, max, age, want, reason] of AGE_ROWS) {
    const e = { min_age: min, max_age: max };
    assert.equal(L.ageOk(e, age), want, `min ${min} max ${max} age ${age}: ${reason}`);
  }
});

test("ageOk: no age picked and string ages", () => {
  const e = { min_age: 12, max_age: 18 };
  assert.equal(L.ageOk(e, null), true, "no age picked means no filter");
  assert.equal(L.ageOk(e, undefined), true, "no age picked means no filter");
  assert.equal(L.ageOk(e, "11"), false, "string age 11 is under min 12 (converted with +age)");
  assert.equal(L.ageOk(e, "12"), true, "string age 12 is exactly min 12");
  assert.equal(L.ageOk({ min_age: null, max_age: null }, "19"), true, "string age with no limits passes");
});

// Deadline rows relative to a "now" day. Each row: [nowDay, deadline, expected effStatus,
// expected futureDeadline (ISO or null), expected daysUntil, reason].
// The entry status is open-now, so the close-out rule is the only thing that can change it.
const DEADLINE_ROWS = [
  // Ordinary week.
  ["2026-10-10", "2026-10-09", "closed-expect-reopen", null, -1, "deadline was yesterday: closed, expect reopen"],
  ["2026-10-10", "2026-10-10", "open-now", "2026-10-10", 0, "deadline is today: still open for the whole day"],
  ["2026-10-10", "2026-10-11", "open-now", "2026-10-11", 1, "deadline is tomorrow: open, one day left"],
  // Days around the US spring forward (2026-03-08, a 23 hour day in New York).
  ["2026-03-07", "2026-03-06", "closed-expect-reopen", null, -1, "deadline was yesterday before spring forward"],
  ["2026-03-07", "2026-03-07", "open-now", "2026-03-07", 0, "deadline is today before spring forward"],
  ["2026-03-07", "2026-03-08", "open-now", "2026-03-08", 1, "deadline is the clock change day: a 24 hour gap from midnight to midnight"],
  ["2026-03-07", "2026-03-09", "open-now", "2026-03-09", 2, "47 hour gap over spring forward rounds to 2 days"],
  ["2026-03-08", "2026-03-07", "closed-expect-reopen", null, -1, "deadline was the day before the clock change day"],
  ["2026-03-08", "2026-03-08", "open-now", "2026-03-08", 0, "deadline is the clock change day itself: still open"],
  ["2026-03-08", "2026-03-09", "open-now", "2026-03-09", 1, "23 hour gap over spring forward rounds to 1 day"],
  ["2026-03-09", "2026-03-08", "closed-expect-reopen", null, -1, "23 hour gap backwards rounds to -1 day"],
  ["2026-03-09", "2026-03-09", "open-now", "2026-03-09", 0, "deadline is today after spring forward"],
  ["2026-03-09", "2026-03-10", "open-now", "2026-03-10", 1, "deadline is tomorrow after spring forward"],
  // Days around the US fall back (2026-11-01, a 25 hour day in New York).
  ["2026-10-31", "2026-10-30", "closed-expect-reopen", null, -1, "deadline was yesterday before fall back"],
  ["2026-10-31", "2026-10-31", "open-now", "2026-10-31", 0, "deadline is today before fall back"],
  ["2026-10-31", "2026-11-01", "open-now", "2026-11-01", 1, "deadline is the clock change day: 24 hour gap from midnight to midnight"],
  ["2026-11-01", "2026-10-31", "closed-expect-reopen", null, -1, "deadline was the day before fall back: 24 hour gap backwards"],
  ["2026-11-01", "2026-11-01", "open-now", "2026-11-01", 0, "deadline is the clock change day itself: still open"],
  ["2026-11-01", "2026-11-02", "open-now", "2026-11-02", 1, "25 hour gap over fall back rounds to 1 day"],
  ["2026-11-02", "2026-11-01", "closed-expect-reopen", null, -1, "25 hour gap backwards rounds to -1 day"],
  ["2026-11-02", "2026-11-02", "open-now", "2026-11-02", 0, "deadline is today after fall back"],
  ["2026-11-02", "2026-11-03", "open-now", "2026-11-03", 1, "deadline is tomorrow after fall back"],
];

for (const tz of ZONES) {
  for (const [hh, mm, label] of [[12, 0, "noon"], [23, 59, "23:59"]]) {
    test(`effStatus, futureDeadline, daysUntil at the day edges (${tz}, ${label})`, () => {
      inZone(tz, () => {
        for (const [nowDay, deadline, wantStatus, wantFuture, wantDays, reason] of DEADLINE_ROWS) {
          const now = localAt(nowDay, hh, mm);
          const e = { status: "open-now", deadline_iso: deadline };
          const where = `${tz} now ${nowDay} ${label}, deadline ${deadline}: ${reason}`;
          assert.equal(L.effStatus(e, now), wantStatus, `effStatus, ${where}`);
          const fd = L.futureDeadline(e, now);
          assert.equal(fd === null ? null : L.toISO(fd), wantFuture, `futureDeadline, ${where}`);
          assert.equal(L.daysUntil(L.parseISO(deadline), now), wantDays, `daysUntil, ${where}`);
        }
      });
    });
  }
}

test("effStatus: other statuses around a deadline edge (zone-independent)", () => {
  const now = localAt("2026-10-10", 12, 0);
  const yesterday = "2026-10-09";
  const today = "2026-10-10";
  const tomorrow = "2026-10-11";
  const rows = [
    // [status, extra fields, expected effStatus, expected futureDeadline ISO or null, reason]
    ["rolling", { deadline_iso: yesterday }, "rolling", null, "rolling is not closed by a past deadline, and a past date is not a future deadline"],
    ["event", { deadline_iso: yesterday }, "event", null, "event is not closed by a past deadline"],
    ["event", { deadline_iso: today }, "event", today, "event with a deadline today still counts for the day"],
    ["unconfirmed", { deadline_iso: today }, "unconfirmed", null, "unconfirmed never gets a future deadline"],
    ["open-now", { deadline_iso: null }, "open-now", null, "no deadline: nothing to close, no future date"],
    ["opens-soon", { deadline_iso: tomorrow, opens_iso: today }, "open-now", tomorrow, "opens today, so it is open now"],
    ["opens-soon", { deadline_iso: tomorrow, opens_iso: tomorrow }, "opens-soon", tomorrow, "opens tomorrow, so still opens soon"],
    ["opens-soon", { deadline_iso: yesterday, opens_iso: null }, "closed-expect-reopen", null, "deadline passed before it ever opened: closed, expect reopen"],
  ];
  for (const [status, extra, wantStatus, wantFuture, reason] of rows) {
    const e = { status, ...extra };
    assert.equal(L.effStatus(e, now), wantStatus, `effStatus (${status}): ${reason}`);
    const fd = L.futureDeadline(e, now);
    assert.equal(fd === null ? null : L.toISO(fd), wantFuture, `futureDeadline (${status}): ${reason}`);
  }
});

// Malformed deadline_iso values. Each must give no deadline, keep the stored status, and never throw.
const MALFORMED = [
  ["", "empty string: no date to read"],
  ["2026-02-30", "February 30 does not exist, so the parser rejects it instead of rolling to March"],
  ["2026-13-01", "month 13 does not exist, so the parser rejects it"],
  [20261010, "a number is not a yyyy-mm-dd string, so the parser rejects it"],
];

test("malformed deadline_iso: no deadline, stored status kept, never throws", () => {
  const now = localAt("2026-10-10", 12, 0);
  for (const [raw, reason] of MALFORMED) {
    assert.equal(L.parseISO(raw), null, `parseISO: ${reason}`);
    for (const status of ["open-now", "rolling", "closed-expect-reopen"]) {
      const e = { status, deadline_iso: raw, deadline_confidence: "confirmed-2026-27" };
      assert.doesNotThrow(() => L.effStatus(e, now), `effStatus must not throw (${String(raw)})`);
      assert.equal(L.effStatus(e, now), status, `effStatus keeps "${status}" with no usable date: ${reason}`);
      assert.equal(L.futureDeadline(e, now), null, `futureDeadline is null: ${reason}`);
      assert.equal(L.knownDeadline(e, now), null, `knownDeadline is null: ${reason}`);
    }
  }
});

test("zone switch is in effect for the day-edge rows", () => {
  // Sanity check on the harness itself: if the zone did not change, the DST rows above would prove nothing.
  // New York: EST (offset +300 minutes) on 2026-03-07 noon, EDT (+240) on 2026-03-08 noon.
  // Auckland: NZDT (offset -780) on both days, so the zone is visibly not New York.
  inZone("America/New_York", () => {
    assert.equal(localAt("2026-03-07", 12, 0).getTimezoneOffset(), 300, "New York is still on standard time before spring forward");
    assert.equal(localAt("2026-03-08", 12, 0).getTimezoneOffset(), 240, "New York is on daylight time after spring forward");
  });
  inZone("Pacific/Auckland", () => {
    assert.equal(localAt("2026-03-08", 12, 0).getTimezoneOffset(), -780, "Auckland is on daylight time in March");
  });
});
