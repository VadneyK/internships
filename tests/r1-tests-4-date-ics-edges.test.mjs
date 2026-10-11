// Edge cases for lib.js date helpers and the ICS builder. Complements r1-tests-2-ics-fold (long-line folding), so only new cases are here.
// Run with: node --test tests/r1-tests-4-date-ics-edges.test.mjs
process.env.TZ = "America/Los_Angeles"; // set before any Date is made, so DST days are real
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

test("parseISO rejects impossible and malformed dates", () => {
  for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-04-31", "2027-02-29", "", null, undefined, "2026-1-5", "20261010", "2026-10-10T00:00", " 2026-10-10"]) {
    assert.equal(L.parseISO(bad), null, "rejects " + JSON.stringify(bad));
  }
});

test("parseISO accepts real edge dates", () => {
  const d = L.parseISO("2028-02-29");
  assert.ok(d instanceof Date);
  assert.equal(L.toISO(d), "2028-02-29");
  assert.equal(L.toISO(L.parseISO("2026-12-31")), "2026-12-31");
  assert.equal(L.toISO(L.parseISO("2000-02-29")), "2000-02-29");
  assert.equal(L.parseISO("2100-02-29"), null, "2100 is not a leap year");
});

test("addDays crosses month, year and leap boundaries", () => {
  assert.equal(L.addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(L.addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(L.addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(L.addDays("2028-02-28", 2), "2028-03-01");
  assert.equal(L.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(L.addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(L.addDays("2026-10-10", 0), "2026-10-10");
  assert.equal(L.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(L.addDays("2026-10-10", 365), "2027-10-10");
  assert.equal(L.addDays("2026-02-30", 1), "", "invalid input gives empty string");
  assert.equal(L.addDays("", 1), "");
});

test("addDays steps over both DST change days without skipping or repeating a date", () => {
  assert.equal(L.addDays("2026-03-07", 1), "2026-03-08");
  assert.equal(L.addDays("2026-03-08", 1), "2026-03-09");
  assert.equal(L.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(L.addDays("2026-11-01", 1), "2026-11-02");
  assert.equal(L.addDays("2026-03-01", 14), "2026-03-15");
});

test("followUpISO is a week after a sent date and crosses boundaries", () => {
  assert.equal(L.followUpISO({ s: "sent", d: "2026-12-28" }), "2027-01-04");
  assert.equal(L.followUpISO({ s: "sent", d: "2028-02-25" }), "2028-03-03");
  assert.equal(L.followUpISO({ s: "sent", d: "2026-10-31" }), "2026-11-07");
  assert.equal(L.followUpISO({ s: "", d: "2026-10-10" }), "");
  assert.equal(L.followUpISO({ s: "sent", d: "" }), "");
  assert.equal(L.followUpISO({ s: "sent", d: "2026-02-30" }), "");
  assert.equal(L.followUpISO(null), "");
});

test("test runs in Los Angeles time", () => {
  assert.equal(new Date(2026, 6, 1).getTimezoneOffset(), 420);
  assert.equal(new Date(2026, 0, 1).getTimezoneOffset(), 480);
});

test("daysUntil returns a whole number on and around both DST change days", () => {
  const cases = [
    ["2026-03-08", ["2026-03-07T20:00:00", "2026-03-08T00:30:00", "2026-03-08T01:59:00", "2026-03-08T03:30:00", "2026-03-08T23:59:00"]],
    ["2026-11-01", ["2026-10-31T20:00:00", "2026-11-01T00:30:00", "2026-11-01T03:30:00", "2026-11-01T23:59:00"]],
  ];
  for (const [iso, nows] of cases) {
    const d = L.parseISO(iso);
    for (const n of nows) {
      const v = L.daysUntil(d, new Date(n));
      assert.ok(Number.isInteger(v), iso + " from " + n + " gave " + v);
    }
    assert.equal(L.daysUntil(d, new Date(iso + "T12:00:00")), 0, iso + " is today at noon");
  }
  // Across a change day the count is still calendar days.
  assert.equal(L.daysUntil(L.parseISO("2026-03-09"), new Date("2026-03-07T12:00:00")), 2);
  assert.equal(L.daysUntil(L.parseISO("2026-03-08"), new Date("2026-03-07T23:30:00")), 1);
  assert.equal(L.daysUntil(L.parseISO("2026-11-02"), new Date("2026-10-31T12:00:00")), 2);
  assert.equal(L.daysUntil(L.parseISO("2026-11-01"), new Date("2026-10-31T23:30:00")), 1);
  assert.equal(L.daysUntil(L.parseISO("2026-10-09"), new Date("2026-10-10T12:00:00")), -1);
});

test("toISO(parseISO(x)) round trips for 200 seeded dates, and addDays matches day counting", () => {
  let seed = 20261010;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let leapSeen = false;
  for (let i = 0; i < 200; i++) {
    const y = 1990 + Math.floor(rnd() * 120), m = 1 + Math.floor(rnd() * 12);
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const day = 1 + Math.floor(rnd() * dim);
    const iso = y + "-" + String(m).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    if (iso.endsWith("-02-29")) leapSeen = true;
    assert.equal(L.toISO(L.parseISO(iso)), iso);
    const n = Math.floor(rnd() * 800) - 400;
    const expect = new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
    assert.equal(L.addDays(iso, n), expect, iso + " + " + n);
  }
  // Make sure leap days are covered even if the seed missed them.
  for (const iso of ["2024-02-29", "2028-02-29", "2000-02-29"]) assert.equal(L.toISO(L.parseISO(iso)), iso);
  void leapSeen;
});

// ---- icsEvent ----
const STAMP = new Date(Date.UTC(2026, 9, 10, 12, 0, 0));
const unfold = (ics) => ics.replace(/\r\n /g, "").split("\r\n");
const field = (ics, name) => unfold(ics).find((l) => l.startsWith(name));

test("icsEvent basics: CRLF, UID, DTEND after DTSTART, 75 octet lines", () => {
  const ics = L.icsEvent({ uid: "abc-123", title: "Apply to Camp", desc: "Short note", dateISO: "2026-10-14", stamp: STAMP });
  assert.ok(ics.endsWith("\r\n"));
  assert.ok(!/(^|[^\r])\n/.test(ics), "no bare LF");
  assert.ok(!/\r(?!\n)/.test(ics), "no bare CR");
  assert.match(field(ics, "UID:"), /^UID:abc-123@vadneyk\.github\.io$/);
  assert.equal(field(ics, "DTSTAMP:"), "DTSTAMP:20261010T120000Z");
  const s = field(ics, "DTSTART").split(":")[1], e = field(ics, "DTEND").split(":")[1];
  assert.equal(s, "20261014");
  assert.ok(e > s, "DTEND after DTSTART");
  assert.equal(e, "20261015");
  for (const l of ics.split("\r\n")) assert.ok(Buffer.byteLength(l) <= 75);
});

test("icsEvent DTEND is the next day across month, year and leap edges", () => {
  const end = (d) => field(L.icsEvent({ uid: "u", title: "t", desc: "d", dateISO: d, stamp: STAMP }), "DTEND").split(":")[1];
  assert.equal(end("2026-12-31"), "20270101");
  assert.equal(end("2028-02-28"), "20280229");
  assert.equal(end("2028-02-29"), "20280301");
  assert.equal(end("2026-02-28"), "20260301");
  assert.equal(end("2026-03-08"), "20260309");
  assert.equal(end("2026-11-01"), "20261102");
  for (const d of ["2026-12-31", "2028-02-29", "2026-03-08", "2026-11-01"]) {
    const ics = L.icsEvent({ uid: "u", title: "t", desc: "d", dateISO: d, stamp: STAMP });
    assert.ok(end(d) > field(ics, "DTSTART").split(":")[1]);
  }
});

test("icsEvent escapes comma, semicolon, backslash and newline", () => {
  const ics = L.icsEvent({ uid: "u", title: "Fair, Inc; Room\\2", desc: "Line one\nLine two\r\nLine, three; four\\", dateISO: "2026-10-14", stamp: STAMP });
  assert.equal(field(ics, "SUMMARY:"), "SUMMARY:Fair\\, Inc\\; Room\\\\2");
  assert.equal(field(ics, "DESCRIPTION:"), "DESCRIPTION:Line one\\nLine two\\nLine\\, three\\; four\\\\");
  assert.ok(!unfold(ics).some((l) => l.startsWith("Line")), "no raw newline leaked into a new line");
  assert.equal(unfold(ics).filter((l) => l === "END:VEVENT").length, 1);
});

test("icsEvent keeps injected line breaks from adding new properties", () => {
  const ics = L.icsEvent({ uid: "u", title: "Hi\r\nATTENDEE:mailto:x@y.z", desc: "", dateISO: "2026-10-14", stamp: STAMP });
  assert.ok(!unfold(ics).some((l) => l.startsWith("ATTENDEE")));
});

test("icsEvent handles missing title or description and returns empty for bad dates", () => {
  const ics = L.icsEvent({ uid: "u", dateISO: "2026-10-14", stamp: STAMP });
  assert.equal(field(ics, "SUMMARY:"), "SUMMARY:");
  assert.equal(field(ics, "DESCRIPTION:"), "DESCRIPTION:");
  for (const bad of [null, undefined, {}, { dateISO: "2026-02-30" }, { dateISO: "" }, { dateISO: "2026-13-01" }]) {
    assert.equal(L.icsEvent(bad), "");
  }
});

test("icsEvent very long title with commas stays under 75 octets and keeps every logical line", () => {
  const ics = L.icsEvent({ uid: "u", title: "a, b; c ".repeat(60), desc: "x".repeat(500), dateISO: "2028-02-29", stamp: STAMP });
  for (const l of ics.split("\r\n")) assert.ok(Buffer.byteLength(l) <= 75);
  assert.equal(unfold(ics)[0], "BEGIN:VCALENDAR");
  assert.equal(unfold(ics).filter((l) => l.startsWith("SUMMARY:")).length, 1);
});
