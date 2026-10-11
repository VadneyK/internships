// ICS output checks for lib.icsEvent: RFC 5545 line length (75 octets), CRLF folding, and a parse-back round trip.
// If icsEvent does not fold long lines, these tests fail on purpose: a follow-up code ticket must add folding to assets/js/lib.js.
// Run with: node --test tests/r1-tests-2-ics-fold.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const entries = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

const STAMP = new Date(Date.UTC(2026, 9, 10, 12, 0, 0));
const make = (title, desc) => L.icsEvent({ uid: "fold-test", title, desc, dateISO: "2026-10-14", stamp: STAMP });

// Remove CRLF plus one space (RFC 5545 unfolding), then split into logical lines.
function unfold(ics) { return ics.replace(/\r\n /g, "").split("\r\n"); }
// Undo icsEscape in one pass so "\\n" (backslash then n) is not confused with a newline escape.
function unescape(t) { return t.replace(/\\([\\;,nN])/g, (m, c) => (c === "n" || c === "N" ? "\n" : c)); }
function valueOf(ics, name) {
  const line = unfold(ics).find((l) => l.startsWith(name + ":"));
  assert.ok(line, name + " line exists");
  return unescape(line.slice(name.length + 1));
}
// The text may hold raw CR/LF, which icsEscape turns into \n, so compare after the same normalisation.
const norm = (s) => String(s || "").replace(/\r?\n/g, "\n");

function checkStructure(ics, label) {
  const phys = ics.split("\r\n");
  assert.equal(phys[phys.length - 1], "", label + ": one trailing CRLF");
  assert.ok(!/(^|[^\r])\n/.test(ics), label + ": every line break is CRLF");
  assert.ok(!/\r(?!\n)/.test(ics), label + ": no bare CR");
  phys.forEach((l, i) => {
    assert.ok(Buffer.byteLength(l, "utf8") <= 75, label + ": line " + i + " is " + Buffer.byteLength(l, "utf8") + " octets, over 75");
    // A continuation line starts with one fold space; a second leading space is real text that landed at the fold.
  });
  const logical = unfold(ics);
  const count = (s) => logical.filter((l) => l === s).length;
  assert.equal(count("BEGIN:VCALENDAR"), 1, label);
  assert.equal(count("END:VCALENDAR"), 1, label);
  assert.equal(count("BEGIN:VEVENT"), 1, label);
  assert.equal(count("END:VEVENT"), 1, label);
  assert.ok(logical.indexOf("BEGIN:VCALENDAR") < logical.indexOf("BEGIN:VEVENT"), label);
  assert.ok(logical.indexOf("END:VEVENT") < logical.indexOf("END:VCALENDAR"), label);
  const start = logical.find((l) => l.startsWith("DTSTART"));
  assert.match(start, /^DTSTART;VALUE=DATE:\d{8}$/, label + ": DTSTART is a DATE value");
}

function check(title, desc, label) {
  const ics = make(title, desc);
  checkStructure(ics, label);
  assert.equal(valueOf(ics, "SUMMARY"), norm(title), label + ": title round trips");
  assert.equal(valueOf(ics, "DESCRIPTION"), norm(desc), label + ": description round trips");
}

const synthetic = [
  ["400 character title", "x".repeat(400), "short note"],
  ["400 character title with commas", ("word, ").repeat(70).slice(0, 400), "a;b\\c\nd"],
  ["multibyte only title", "日本語のタイトル".repeat(20), "é".repeat(100)],
  ["emoji title and notes", "Summer 🌞 job fair 🎉 ".repeat(8), "Bring ID 📄, a pen ✏️; ask for Zoë.\nThanks 🙏".repeat(4)],
  ["accented letters", "Café Résumé Niño Ångström ".repeat(6), "Naïve façade über ".repeat(20)],
];
// A comma (escaped to two octets) placed so it lands on, just before, and just after the 75 octet mark.
// "SUMMARY:" is 8 octets, so 66 letters put the backslash at octet 75.
for (let pad = 64; pad <= 68; pad++) {
  synthetic.push(["comma at the 75 byte boundary, pad " + pad, "a".repeat(pad) + ",bbbb,cccc", "d".repeat(pad - 3) + ",;\\\n" + "e".repeat(20)]);
}
// A multibyte letter straddling the boundary, so a naive byte cut would split it.
for (let pad = 64; pad <= 68; pad++) {
  synthetic.push(["multibyte at the boundary, pad " + pad, "a".repeat(pad) + "éé日🙂zz", "b".repeat(pad) + "éé日🙂zz"]);
}

for (const [label, title, desc] of synthetic) {
  test("icsEvent folds and round trips: " + label, () => check(title, desc, label));
}

test("icsEvent folds and round trips every real program in data/entries.json", () => {
  assert.ok(entries.length > 100, "entries loaded");
  const failures = [];
  let longest = 0;
  for (const e of entries) {
    const title = e.name || "", desc = e.notes || "";
    try { check(title, desc, e.id); } catch (err) { failures.push(e.id + ": " + err.message.split("\n")[0]); }
    longest = Math.max(longest, Buffer.byteLength(title, "utf8"), Buffer.byteLength(desc, "utf8"));
  }
  assert.ok(longest > 0);
  assert.equal(failures.length, 0, failures.length + " of " + entries.length + " entries failed. First: " + failures.slice(0, 3).join(" | "));
});

test("icsEvent folded lines use CRLF plus exactly one space", () => {
  const ics = make("x".repeat(400), "y");
  assert.ok(ics.includes("\r\n "), "a 400 character title must be folded");
});
