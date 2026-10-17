// Add to calendar (issue #10): lib.calEvent decides which cards get the button, lib.icsEvent writes the .ics file
// (RFC 5545: CRLF, 75 octet folding, escaping, all-day DATE values, a stable UID, reminders a week and a day before)
// and lib.gcalHref writes the Google Calendar link. No browser: plain lib.js in Node.
// Run with: node --test tests/add-to-calendar.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

const NOW = new Date(2026, 9, 16, 10, 0, 0).getTime();
const STAMP = new Date(Date.UTC(2026, 9, 16, 17, 5, 9));
const base = {
  id: "test-prog", name: "Test Program", org: "Test Org", url: "https://example.org/apply",
  status: "open-now", deadline_iso: "2026-10-30", opens_iso: null, deadline_confidence: "confirmed-2026-27",
};
const mk = (o) => Object.assign({}, base, o);
const ics = (e) => L.icsEvent(Object.assign(L.calEvent(e, NOW), { stamp: STAMP }));

// RFC 5545 3.1: remove CRLF plus one space, then split into content lines.
const unfold = (t) => t.replace(/\r\n /g, "").split("\r\n");
const value = (t, name) => {
  const line = unfold(t).find((l) => l.startsWith(name + ":"));
  assert.ok(line, name + " line exists");
  return line.slice(name.length + 1);
};
const unescape = (t) => t.replace(/\\([\\;,nN])/g, (m, c) => (c === "n" || c === "N" ? "\n" : c));

test("calEvent: a confirmed date that is still ahead gets an event", () => {
  const c = L.calEvent(base, NOW);
  assert.ok(c);
  assert.equal(c.dateISO, "2026-10-30");
  assert.equal(c.uid, "deadline-test-prog");
  assert.equal(c.file, "test-prog-deadline.ics");
  assert.equal(c.url, "https://example.org/apply");
  assert.equal(c.title, "Last day to apply: Test Program");
  assert.match(c.desc, /Test Org/);
  assert.ok(c.desc.includes("https://example.org/apply"), "the description carries the official page");
  assert.deepEqual(c.alarms, ["-P6DT15H", "-PT15H"]);
  assert.ok(L.calEvent(mk({ status: "opens-soon", opens_iso: "2026-11-01", deadline_iso: "2027-01-08" }), NOW), "opens soon, with a later closing date");
  assert.ok(L.calEvent(mk({ deadline_iso: "2026-10-16" }), NOW), "a deadline today still counts");
  assert.ok(L.calEvent(mk({ status: "closed-expect-reopen", deadline_iso: "2027-02-08" }), NOW), "closed now, with a confirmed date for the next cycle");
});

test("calEvent: no button for last-year dates, past or missing dates, events, opening days or closed programs", () => {
  const no = {
    "last-year-pattern, even on an open card": mk({ deadline_confidence: "last-year-pattern" }),
    "unknown confidence": mk({ deadline_confidence: "unknown" }),
    "rolling confidence": mk({ deadline_confidence: "rolling" }),
    "deadline passed": mk({ deadline_iso: "2026-10-15" }),
    "no date": mk({ deadline_iso: null }),
    "bad date": mk({ deadline_iso: "2026-13-40" }),
    "closed with a past date": mk({ status: "closed-expect-reopen", deadline_iso: "2026-03-01" }),
    "closed and unconfirmed for next cycle": mk({ status: "closed-expect-reopen", deadline_confidence: "last-year-pattern", deadline_iso: "2027-03-01" }),
    "an event day is not a deadline": mk({ status: "event", deadline_iso: "2026-11-14" }),
    "the date is only the opening day": mk({ status: "opens-soon", opens_iso: "2026-11-01", deadline_iso: "2026-11-01" }),
    "year-round program": mk({ status: "year-round" }),
  };
  for (const [why, e] of Object.entries(no)) {
    assert.equal(L.calEvent(e, NOW), null, why);
    assert.equal(L.calButtons(e, NOW), "", why + ": no controls");
  }
  assert.equal(L.calEvent(null, NOW), null);
  assert.equal(L.calButtons(undefined, NOW), "");
});

test("icsEvent: CRLF line ends, one trailing CRLF, and the right blocks in the right order", () => {
  const t = ics(base);
  assert.ok(t.endsWith("\r\n") && !t.endsWith("\r\n\r\n"), "one trailing CRLF");
  assert.ok(!/(^|[^\r])\n/.test(t), "every line break is CRLF");
  assert.ok(!/\r(?!\n)/.test(t), "no bare CR");
  const lines = unfold(t).slice(0, -1);
  const at = (l) => lines.indexOf(l);
  assert.equal(lines[0], "BEGIN:VCALENDAR");
  assert.equal(lines[1], "VERSION:2.0");
  assert.equal(lines.at(-1), "END:VCALENDAR");
  assert.ok(at("BEGIN:VEVENT") < at("BEGIN:VALARM") && lines.lastIndexOf("END:VALARM") < at("END:VEVENT"), "alarms sit inside the event");
  assert.equal(lines.filter((l) => l === "BEGIN:VALARM").length, 2);
  assert.equal(lines.filter((l) => l === "END:VALARM").length, 2);
});

test("icsEvent: all-day DTSTART and DTEND are DATE values, the end is the next day, also across a month and a year", () => {
  for (const [d, start, end] of [["2026-10-30", "20261030", "20261031"], ["2026-10-31", "20261031", "20261101"], ["2026-12-31", "20261231", "20270101"], ["2028-02-28", "20280228", "20280229"]]) {
    const lines = unfold(ics(mk({ deadline_iso: d })));
    assert.ok(lines.includes("DTSTART;VALUE=DATE:" + start), d + " start");
    assert.ok(lines.includes("DTEND;VALUE=DATE:" + end), d + " end");
    assert.ok(!lines.some((l) => /^DT(START|END)[:;].*T\d{6}/.test(l)), d + ": no time of day, so no time zone shift");
  }
});

test("icsEvent: a stable UID per program, a UTC DTSTAMP, the official URL and two 9 AM reminders", () => {
  const t = ics(base);
  assert.equal(value(t, "UID"), "deadline-test-prog@vadneyk.github.io");
  assert.equal(L.icsEvent(Object.assign(L.calEvent(base, NOW), { stamp: new Date() })).match(/^UID:.*$/m)[0], "UID:deadline-test-prog@vadneyk.github.io", "same UID whenever it is saved, so saving twice updates one event");
  assert.equal(value(t, "DTSTAMP"), "20261016T170509Z");
  assert.equal(value(t, "URL"), "https://example.org/apply");
  const triggers = unfold(t).filter((l) => l.startsWith("TRIGGER:")).map((l) => l.slice(8));
  assert.deepEqual(triggers, ["-P6DT15H", "-PT15H"], "9 AM seven days before and 9 AM the day before (the day starts at midnight)");
  assert.equal(unfold(t).filter((l) => l === "ACTION:DISPLAY").length, 2);
  // A DISPLAY alarm must have a DESCRIPTION (RFC 5545 3.6.6): the event has one, and each alarm has one.
  assert.equal(unfold(t).filter((l) => l.startsWith("DESCRIPTION:")).length, 3);
});

test("icsEvent: commas, semicolons, backslashes and new lines in a name are escaped and round trip", () => {
  const name = "Art, Music; and Code \\ Lab\nSpring";
  const t = ics(mk({ name, org: "A, B; C" }));
  const summary = value(t, "SUMMARY");
  assert.equal(summary, "Last day to apply: Art\\, Music\\; and Code \\\\ Lab\\nSpring");
  assert.equal(unescape(summary), "Last day to apply: " + name);
  assert.match(value(t, "DESCRIPTION"), /A\\, B\\; C/);
  assert.ok(!/[^\\][,;]/.test(summary.replace(/\\[\\,;n]/g, "")), "no bare comma or semicolon left in SUMMARY");
});

test("icsEvent: long and multibyte names fold at 75 octets and unfold to the same text", () => {
  for (const name of ["x".repeat(300), "Campamento de verano para jóvenes en Nueva York ".repeat(5), "日本語のプログラム🎉".repeat(15)]) {
    const t = ics(mk({ name }));
    for (const l of t.split("\r\n")) assert.ok(Buffer.byteLength(l, "utf8") <= 75, "line of " + Buffer.byteLength(l, "utf8") + " octets");
    assert.ok(t.split("\r\n").some((l) => l.startsWith(" ")), "a long line was folded");
    assert.equal(unescape(value(t, "SUMMARY")), "Last day to apply: " + name);
    assert.ok(!t.includes("�"), "no character was cut in half");
  }
});

test("gcalHref: a Google Calendar template link for the same all-day event, with nothing else in it", () => {
  const c = L.calEvent(mk({ name: "Art & Code #1", deadline_iso: "2026-12-31" }), NOW);
  const u = new URL(L.gcalHref(c));
  assert.equal(u.origin + u.pathname, "https://calendar.google.com/calendar/render");
  assert.deepEqual([...u.searchParams.keys()], ["action", "text", "dates", "details"], "no tracking or extra keys");
  assert.equal(u.searchParams.get("action"), "TEMPLATE");
  assert.equal(u.searchParams.get("dates"), "20261231/20270101");
  assert.equal(u.searchParams.get("text"), "Last day to apply: Art & Code #1");
  assert.equal(u.searchParams.get("details"), c.desc);
});

test("calButtons: one .ics button and one Google Calendar link, named for the program and escaped", () => {
  const e = mk({ id: "a\"b", name: "<Fun> & \"Games\"" });
  const doc = new JSDOM("<div>" + L.calButtons(e, NOW) + "</div>").window.document;
  const b = doc.querySelectorAll("button");
  const a = doc.querySelectorAll("a");
  assert.equal(b.length, 1);
  assert.equal(a.length, 1);
  assert.equal(doc.querySelectorAll("script, [onclick]").length, 0);
  assert.equal(b[0].getAttribute("type"), "button");
  assert.equal(b[0].getAttribute("data-cal"), "a\"b");
  assert.equal(b[0].textContent, "Add deadline to calendar");
  assert.equal(b[0].getAttribute("aria-label"), "Add deadline to calendar for <Fun> & \"Games\"");
  assert.equal(a[0].textContent, "Google Calendar");
  assert.equal(a[0].getAttribute("aria-label"), "Google Calendar: add deadline for <Fun> & \"Games\"");
  assert.equal(a[0].getAttribute("href"), L.gcalHref(L.calEvent(e, NOW)));
  assert.equal(a[0].getAttribute("target"), "_blank");
  assert.equal(a[0].getAttribute("rel"), "noopener");
  for (const el of [b[0], a[0]]) {
    assert.deepEqual([...el.classList].sort(), ["alt", "btn", "noprint", "sm"], "the small card button style, 44px tall, hidden in print");
  }
});

test("real data: every card with the button has a confirmed date still ahead, and its .ics file is well formed", () => {
  const withCal = ENTRIES.filter((e) => L.calEvent(e, NOW));
  assert.ok(withCal.length > 50, "many cards get the button (" + withCal.length + ")");
  for (const e of withCal) {
    assert.equal(e.deadline_confidence, "confirmed-2026-27", e.id);
    assert.ok(e.deadline_iso >= "2026-10-16", e.id);
    assert.notEqual(e.opens_iso, e.deadline_iso, e.id);
    const t = ics(e);
    for (const l of t.split("\r\n")) assert.ok(Buffer.byteLength(l, "utf8") <= 75, e.id);
    assert.ok(unfold(t).includes("DTSTART;VALUE=DATE:" + e.deadline_iso.replace(/-/g, "")), e.id);
    assert.equal(unescape(value(t, "SUMMARY")), "Last day to apply: " + e.name, e.id);
  }
  for (const e of ENTRIES.filter((x) => x.deadline_confidence === "last-year-pattern")) assert.equal(L.calEvent(e, NOW), null, e.id);
});
