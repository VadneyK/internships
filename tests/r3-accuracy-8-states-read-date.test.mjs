// Ticket r3-accuracy-8: the States page lede must not give a newer "last read" date than the section
// dates beside the claims. Every "Last read" / "Read on" / "read on" date in states.html is extracted and
// the page-level stamp must be the newest of them (the same rule tests/r1-accuracy-12-read-stamp-order
// enforces for every page). The Cook County line (read Oct 10, 2026 per data/money.json) is not dated on
// this page, so it cannot be a newer date here.
// Run with: node --test tests/r3-accuracy-8-states-read-date.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "states.html"), "utf8");
const text = html.replace(/<[^>]+>/g, " ").replace(/&middot;/g, " ");

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const DATE = "([A-Z][a-z]{2}) (\\d{1,2}), (2026)";
const toDay = (mon, day, year) => Date.UTC(+year, MONTHS[mon] - 1, +day);

test("States page: the page-level 'Last read' stamp is not older than any 'Read on' or 'read' date on the page", () => {
  const stamp = text.match(new RegExp(`Last read[^.]{0,80}?${DATE}`));
  assert.ok(stamp, "lede has a 'Last read' stamp");
  const pageDay = toDay(stamp[1], stamp[2], stamp[3]);

  // "Last checked" in the print footer is stamped by tools/build.py from the build date, not a read claim,
  // so only "read" and "Read on" dates are compared (as the ticket asks).
  const dates = [...text.matchAll(new RegExp(`\\b(?:Read on|read on|read|Read|Last read)(?: on)? ${DATE}`, "g"))];
  const sectionDays = dates.map((m) => toDay(m[1], m[2], m[3]));
  assert.ok(sectionDays.filter((d) => d === toDay("Oct", "9", "2026")).length >= 2, "section read dates on Oct 9 are present");
  const latest = Math.max(...sectionDays);
  assert.ok(pageDay >= latest, "page stamp (" + stamp[0] + ") is not older than the newest date on the page (" + new Date(latest).toISOString().slice(0, 10) + ")");
});

test("States page: the lede no longer carries the Oct 10 date that is newer than the section dates", () => {
  assert.match(text, /Last read Oct 9, 2026 for most pages\./);
  assert.doesNotMatch(text, /Last read from official pages on Oct 10, 2026/, "old lede with the newer date is gone");
});

test("States page: the picker date matches the Oct 9 section dates", () => {
  assert.match(text, /Each card links the pages we read on Oct 9, 2026\./);
});
