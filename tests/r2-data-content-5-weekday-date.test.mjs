import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Fails when a card states "Weekday, Month D, YYYY" and the weekday is not the real one.
// Cards whose own text says "that date is a ..." or "confirm" are allowed (they flag it).
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const FIELDS = ["deadline_text", "how_to_apply", "duration", "notes", "who_can_apply", "what_you_do"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const RE = new RegExp(`\\b(${DAYS.join("|")}),?\\s+(${MONTHS.join("|")}|${SHORT.join("|")})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, "g");

function mismatches(text) {
  const out = [];
  for (const m of text.matchAll(RE)) {
    const mi = MONTHS.findIndex((x) => x === m[2] || x.slice(0, 3) === m[2]);
    const real = DAYS[new Date(Date.UTC(+m[4], mi, +m[3])).getUTCDay()];
    if (real !== m[1]) out.push(`${m[0]} (real: ${real})`);
  }
  return out;
}
const flagged = (t) => /that date is a|confirm/i.test(t);

test("scanner catches a wrong weekday", () => {
  assert.equal(mismatches("closed Thursday, May 1, 2026").length, 1);
  assert.equal(mismatches("due Monday September 8, 2026").length, 1);
  assert.equal(mismatches("closed Friday, May 1, 2026").length, 0);
});

test("no card states a weekday that disagrees with its date", () => {
  const bad = [];
  for (const e of ENTRIES) {
    for (const f of FIELDS) {
      const t = e[f];
      if (typeof t !== "string" || flagged(t)) continue;
      for (const m of mismatches(t)) bad.push(`${e.id}.${f}: ${m}`);
    }
  }
  assert.deepEqual(bad, []);
});
