// r1-tests-2: per-program source files in data/programs/*.json must not contradict themselves on
// status, deadline_iso and deadline_confidence. Checked under three fixed clocks, before build_data runs.
// Every failure names the program id. No real clock is used.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lib = createRequire(import.meta.url)(join(root, "assets/js/lib.js"));
const dir = join(root, "data/programs");
const PROGRAMS = readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ file: f, p: JSON.parse(readFileSync(join(dir, f), "utf8")) }));

// Local noon of a fixed calendar day, so the day is the same in any time zone.
const CLOCKS = [new Date(2026, 9, 10, 12), new Date(2027, 0, 15, 12), new Date(2027, 6, 1, 12)];
const isoOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/*
  Known offenders. Each key is "<rule>:<program id>". Fixing the data makes the entry stale and the
  "allow list is current" test fails, so the entry must be deleted then. Keep each with a reason.
*/
const R = "closed card keeps next cycle date";
const ALLOW = {
  // Closed now, but the source holds a confirmed date for the next cycle. knownDeadline() uses it on purpose.
  // Change status or the date in data/programs when a human has checked, then delete the line.
  "closed-with-future-date:bloomington-iu-jacobs-composition-academy": "closed card keeps next cycle date: page says Spring 2027 registration begins mid November, no day",
  "closed-with-future-date:bloomington-iu-jacobs-dance-summer-intensives": "closed card keeps next cycle date: page says summer 2027 registration opens mid-December, no day",
  "closed-with-future-date:emory-pre-college-program": "closed card keeps next cycle date: page says 2027 applications open in December, no day",
  "closed-with-future-date:lafayette-purdue-sciencescape": "closed card keeps next cycle date: source says applications open mid-March 2027, no day",
  "closed-with-future-date:nc-museum-natural-sciences-cafe-coordinators": R,
  "closed-with-future-date:nc-museum-natural-sciences-climate-resilience-institute": R,
  "closed-with-future-date:nc-museum-natural-sciences-junior-interpreters": "closed card keeps next cycle date: page says applications open mid-January 2027, no day",
  "closed-with-future-date:nyc-columbia-pre-college-nyc-commuter-summer": "closed card keeps next cycle date: source says applications open mid-November 2026, no day",
  "closed-with-future-date:richmond-rcmp-youth-academy": "closed card keeps next cycle date: page says applications posted late 2026 to early 2027, no day",
  "closed-with-future-date:richmond-sd38-biomedical-health-science-dual-credit": R,
  "closed-with-future-date:seattle-teens-in-public-service-summer-internship": "closed card keeps next cycle date: source says applications open mid to late November 2026, exact day not posted",
};

function problems() {
  const out = []; // {key, msg}
  const add = (rule, p, msg) => out.push({ key: rule + ":" + p.id, msg: rule + " " + p.id + ": " + msg });
  for (const { file, p } of PROGRAMS) {
    const d = p.deadline_iso;
    if (d != null) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
      const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
      if (!dt || dt.getFullYear() !== +m[1] || dt.getMonth() !== +m[2] - 1 || dt.getDate() !== +m[3]) add("bad-date", p, "deadline_iso " + JSON.stringify(d) + " is not a real date (" + file + ")");
    }
    if (d && (p.deadline_confidence === "unknown" || p.deadline_confidence === "none")) add("date-with-unknown-confidence", p, "deadline_iso " + d + " but confidence is " + p.deadline_confidence);
    if (!d) continue;
    for (const now of CLOCKS) {
      const today = isoOf(now), future = d >= today, st = lib.effStatus(p, now), when = " at " + today;
      if (future && (p.status === "open-now" || p.status === "opens-soon") && st === "closed-expect-reopen") add("future-date-shown-closed", p, p.status + " with " + d + " reads closed" + when);
      if (!future && (st === "open-now" || st === "opens-soon")) add("past-date-reads-open", p, "date " + d + " is past but reads " + st + when);
      if (!future && p.status === "rolling") add("rolling-with-past-date", p, "rolling with past date " + d + when);
      if (future && p.status === "closed-expect-reopen") add("closed-with-future-date", p, "closed with future date " + d + when);
    }
  }
  return out;
}

const ALL = problems();

test("programs load", () => {
  assert.ok(PROGRAMS.length > 1000, "expected the per-program files, got " + PROGRAMS.length);
});

test("no new status vs deadline contradictions (each failure names the program id)", () => {
  const fresh = ALL.filter((x) => !(x.key in ALLOW)).map((x) => x.msg);
  assert.deepEqual(Array.from(new Set(fresh)), []);
});

test("allow list is current: every entry still fails, so a fixed one must be removed", () => {
  const live = new Set(ALL.map((x) => x.key));
  const stale = Object.keys(ALLOW).filter((k) => !live.has(k));
  assert.deepEqual(stale, [], "fixed, remove from ALLOW: " + stale.join(", "));
});
