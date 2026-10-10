// Edge cases for the date helpers and the calendar (ICS) output in assets/js/lib.js:
// parseISO, addDays, daysUntil, followUpISO and icsEvent.
// Run with: node --test tests/r1-tests-3.test.mjs
// Every "now" is a fixed local time built with local-time constructors and passed in, so these tests never read the real clock.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

// Local-time constructors match what startOfDay() uses, so these hold in any timezone.
const LATE_EVENING = new Date(2027, 2, 10, 23, 59).getTime(); // Mar 10, 2027, 11:59 pm
const EARLY_MORNING = new Date(2027, 2, 10, 0, 1).getTime(); // Mar 10, 2027, 12:01 am

// Returns the first line of an ICS text that starts with the given prefix.
function icsLine(ics, prefix) {
  return ics.split("\r\n").find((l) => l.startsWith(prefix));
}

// A complete event with fixed values. Tests override only the field they check.
function makeIcs(over) {
  return L.icsEvent({
    uid: "u1",
    title: "Follow up",
    desc: "Check the inbox",
    dateISO: "2027-01-31",
    stamp: new Date(Date.UTC(2027, 0, 31, 23, 59, 58, 123)),
    ...over,
  });
}

test("parseISO: returns null for empty, missing and malformed input", () => {
  // "2027-02-30 " (with a trailing space) is rejected by the shape check, because the regex ends with $.
  for (const bad of ["", null, undefined, "2027-2-3", "2027-02-30 ", "abc"]) {
    assert.equal(L.parseISO(bad), null, "input " + JSON.stringify(bad));
  }
});

test("parseISO: a real leap day becomes a Date", () => {
  const d = L.parseISO("2028-02-29");
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 2028);
  assert.equal(d.getMonth(), 1);
  assert.equal(d.getDate(), 29);
});

// parseISO checks the YYYY-MM-DD shape and also the calendar. "2027-02-30" and "2027-02-29" (2027 is not a leap year)
// must return null, because Date would otherwise roll them over to March.
test("parseISO: a day that does not exist in the month is rejected", () => {
  assert.equal(L.parseISO("2027-02-30"), null);
  assert.equal(L.parseISO("2027-02-29"), null);
});

test("addDays: crosses a month end, a year end and a leap day", () => {
  assert.equal(L.addDays("2027-01-31", 1), "2027-02-01");
  assert.equal(L.addDays("2027-02-28", 1), "2027-03-01"); // 2027 is not a leap year
  assert.equal(L.addDays("2027-04-30", 1), "2027-05-01");
  assert.equal(L.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(L.addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(L.addDays("2028-02-28", 2), "2028-03-01");
  assert.equal(L.addDays("2028-02-29", 0), "2028-02-29");
});

test("addDays: a negative n goes backwards across the same edges", () => {
  assert.equal(L.addDays("2027-03-01", -1), "2027-02-28");
  assert.equal(L.addDays("2028-03-01", -1), "2028-02-29");
  assert.equal(L.addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(L.addDays("2027-03-10", -7), "2027-03-03");
});

test("addDays: bad input returns an empty string", () => {
  for (const bad of ["", null, undefined, "2027-2-3", "2027-02-30 ", "abc"]) {
    assert.equal(L.addDays(bad, 1), "", "input " + JSON.stringify(bad));
  }
});

test("daysUntil: today is 0, tomorrow is 1 and yesterday is -1, late in the evening and early in the morning", () => {
  for (const now of [LATE_EVENING, EARLY_MORNING]) {
    assert.equal(L.daysUntil(L.parseISO("2027-03-10"), now), 0);
    assert.equal(L.daysUntil(L.parseISO("2027-03-11"), now), 1);
    assert.equal(L.daysUntil(L.parseISO("2027-03-09"), now), -1);
  }
});

test("daysUntil: a 23 hour or 25 hour clock-change day still counts as one day", () => {
  // US clocks change on Mar 14, 2027 (23 hour day) and Nov 7, 2027 (25 hour day).
  // Math.round in daysUntil keeps the count at 1 either way.
  assert.equal(L.daysUntil(L.parseISO("2027-03-14"), new Date(2027, 2, 13, 23, 59).getTime()), 1);
  assert.equal(L.daysUntil(L.parseISO("2027-11-07"), new Date(2027, 10, 6, 23, 59).getTime()), 1);
});

test("followUpISO: empty for a draft, a missing or bad send date, and no person", () => {
  assert.equal(L.followUpISO({ s: "draft", d: "2027-03-10" }), "");
  assert.equal(L.followUpISO({ s: "sent" }), "");
  assert.equal(L.followUpISO({ s: "sent", d: "" }), "");
  assert.equal(L.followUpISO({ s: "sent", d: "March 10" }), "");
  assert.equal(L.followUpISO(null), "");
  assert.equal(L.followUpISO(undefined), "");
});

test("followUpISO: seven days after a sent date, across a month end and a leap day", () => {
  assert.equal(L.followUpISO({ s: "sent", d: "2027-03-25" }), "2027-04-01");
  assert.equal(L.followUpISO({ s: "sent", d: "2028-02-25" }), "2028-03-03");
});

test("icsEvent: an event on the last day of a month ends on the first day of the next month", () => {
  let ics = makeIcs({ dateISO: "2027-01-31" });
  assert.equal(icsLine(ics, "DTSTART;"), "DTSTART;VALUE=DATE:20270131");
  assert.equal(icsLine(ics, "DTEND;"), "DTEND;VALUE=DATE:20270201");

  ics = makeIcs({ dateISO: "2026-12-31" });
  assert.equal(icsLine(ics, "DTEND;"), "DTEND;VALUE=DATE:20270101");

  ics = makeIcs({ dateISO: "2028-02-29" });
  assert.equal(icsLine(ics, "DTEND;"), "DTEND;VALUE=DATE:20280301");
});

test("icsEvent: CRLF line endings throughout and exactly one trailing CRLF", () => {
  const ics = makeIcs({ desc: "one\ntwo\r\nthree" });
  assert.doesNotMatch(ics.replace(/\r\n/g, ""), /[\r\n]/, "found a bare CR or LF");
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!ics.endsWith("\r\n\r\n"));
});

test("icsEvent: commas, semicolons, backslashes and newlines are escaped in the title", () => {
  assert.equal(icsLine(makeIcs({ title: "A, B; C\\D" }), "SUMMARY:"), String.raw`SUMMARY:A\, B\; C\\D`);
  // A backslash in front of a comma is escaped once for the backslash and once for the comma.
  assert.equal(icsLine(makeIcs({ title: "a\\,b" }), "SUMMARY:"), String.raw`SUMMARY:a\\\,b`);
  assert.equal(icsLine(makeIcs({ title: "Line one\nLine two" }), "SUMMARY:"), String.raw`SUMMARY:Line one\nLine two`);
});

test("icsEvent: the same escapes apply to the description, and every line break becomes a literal \\n", () => {
  const ics = makeIcs({ desc: "one\ntwo\r\nthree, four; five \\ six" });
  assert.equal(icsLine(ics, "DESCRIPTION:"), String.raw`DESCRIPTION:one\ntwo\nthree\, four\; five \\ six`);
});

test("icsEvent: UID and DTSTAMP come from the inputs, and the injected stamp drops its milliseconds", () => {
  const ics = makeIcs({ uid: "abc123" });
  assert.equal(icsLine(ics, "UID:"), "UID:abc123@vadneyk.github.io");
  assert.equal(icsLine(ics, "DTSTAMP:"), "DTSTAMP:20270131T235958Z");
});
