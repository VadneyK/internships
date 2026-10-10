// Every hour limit used by hoursCheck must be stated in that state's hours text (ticket r3-accuracy-1).
// Run with: node --test tests/r3-accuracy-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

const week = (byDay) => [0, 1, 2, 3, 4, 5, 6].map((i) => byDay[i] || null);

// Clock limits are stored on a 24 hour clock (22 is 10 p.m., 24 is midnight).
function clockWords(n) {
  if (n === 24 || n === 0) return ["midnight", "12 a.m."];
  if (n === 12) return ["noon", "12 p.m."];
  if (n > 12) return [`${n - 12} p.m.`, `${n - 12}:00 p.m.`];
  return [`${n} a.m.`, `${n}:00 a.m.`];
}

test("every non-null limit in every state appears as a number or clock time in that band's hours text", () => {
  let checked = 0;
  for (const [st, s] of Object.entries(PM.states)) {
    for (const [band, lim] of Object.entries(s.limits || {})) {
      if (!lim) continue;
      const text = String((s.hours || {})[band] || "").toLowerCase();
      for (const key of ["schoolWeek", "offWeek", "schoolDay", "nonSchoolDay", "earliest", "latest", "latestSummer"]) {
        const v = lim[key];
        if (v == null) continue;
        checked++;
        if (key === "earliest" || key === "latest" || key === "latestSummer") {
          assert.ok(clockWords(v).some((w) => text.includes(w)), `${st} ${band} ${key} ${v} (${clockWords(v)[0]}) not in hours text`);
        } else {
          assert.match(text, new RegExp(`\\b${v}\\b`), `${st} ${band} ${key} ${v} not in hours text`);
        }
      }
    }
  }
  assert.ok(checked > 100, "the loop should see many limits");
});

test("the three ticket states no longer carry numbers their text never states", () => {
  const mi = PM.states.mi.limits["16"], nj = PM.states.nj.limits["16"], wa = PM.states.wa.limits["16"];
  assert.equal(mi.schoolDay, null);
  assert.equal(mi.nonSchoolDay, null);
  assert.equal(mi.latest, 22);
  assert.match(PM.states.mi.hours["16"], /we check against 10 p\.m\. to stay safe/);
  assert.equal(nj.earliest, null);
  assert.equal(nj.latest, null);
  assert.equal(wa.earliest, 7);
  assert.equal(wa.latest, 22);
  assert.equal(wa.latestSummer, 24);
});

test("hoursCheck: a null daily cap does not make a 'more than the 0 hour limit' message", () => {
  const r = L.hoursCheck(PM.states.mi.limits, 16, true, week({ 0: { from: 15, to: 20 }, 5: { from: 9, to: 17 } }));
  assert.equal(r.limited, true);
  assert.equal(r.problems.filter((p) => /hour limit on/.test(p)).length, 0, r.problems.join("|"));
  assert.deepEqual(r.problems, []);
});

test("hoursCheck: null earliest and latest skip the time of day checks (NJ 16)", () => {
  const r = L.hoursCheck(PM.states.nj.limits, 16, true, week({ 0: { from: 4, to: 8 }, 1: { from: 20, to: 23.5 } }));
  assert.deepEqual(r.problems.filter((p) => /before|past/.test(p)), [], r.problems.join("|"));
});

test("hoursCheck: a null weekly cap skips the week check", () => {
  const r = L.hoursCheck({ "16": { schoolDay: 10, nonSchoolDay: 10, schoolWeek: null, offWeek: null, earliest: 6, latest: 22, latestSummer: null } }, 16, true, week({ 0: { from: 8, to: 16 }, 1: { from: 8, to: 16 }, 2: { from: 8, to: 16 }, 3: { from: 8, to: 16 }, 4: { from: 8, to: 16 }, 5: { from: 8, to: 16 } }));
  assert.deepEqual(r.problems, []);
});

test("hoursCheck: a limit still flags when it is a number (MI latest 22, WA school week 22 and summer 24)", () => {
  const mi = L.hoursCheck(PM.states.mi.limits, 16, true, week({ 0: { from: 17, to: 23 } }));
  assert.ok(mi.problems.some((p) => /working past 10 p\.m\./.test(p)), mi.problems.join("|"));
  const waSchool = L.hoursCheck(PM.states.wa.limits, 16, true, week({ 0: { from: 17, to: 23 } }));
  assert.ok(waSchool.problems.some((p) => /working past 10 p\.m\./.test(p)), waSchool.problems.join("|"));
  const waOut = L.hoursCheck(PM.states.wa.limits, 16, false, week({ 0: { from: 17, to: 23 } }));
  assert.equal(waOut.problems.filter((p) => /past/.test(p)).length, 0, waOut.problems.join("|"));
  const waEarly = L.hoursCheck(PM.states.wa.limits, 16, true, week({ 0: { from: 6, to: 9 } }));
  assert.ok(waEarly.problems.some((p) => /before 7 a\.m\./.test(p)), waEarly.problems.join("|"));
});
