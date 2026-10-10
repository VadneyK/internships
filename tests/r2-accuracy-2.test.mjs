// New York school-out hour rules and the hours text for each state with limits (ticket r2-accuracy-2).
// Run with: node --test tests/r2-accuracy-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const NY = PM.states.ny.limits;

const week = (byDay) => [0, 1, 2, 3, 4, 5, 6].map((i) => byDay[i] || null);

test("hoursCheck: NY 16 working Monday 5 p.m. to 11 p.m. with school out has no 'past' problem", () => {
  const r = L.hoursCheck(NY, 16, false, week({ 0: { from: 17, to: 23 } }));
  assert.equal(NY["16"].latestSummer, 24);
  assert.equal(r.problems.filter((p) => /past/.test(p)).length, 0, r.problems.join("|"));
  assert.deepEqual(r.problems, []);
});

test("hoursCheck: NY 16 with school in session still flags the same Monday 5 p.m. to 11 p.m. shift", () => {
  const r = L.hoursCheck(NY, 16, true, week({ 0: { from: 17, to: 23 } }));
  assert.ok(r.problems.some((p) => p.startsWith("Monday") && /working past 10 p\.m\./.test(p)), r.problems.join("|"));
});

test("NY hours text states the school-out rules for 14 and 15 and for 16 and 17", () => {
  assert.match(PM.states.ny.hours["14"], /When school is closed: not between 9 p\.m\. and 7 a\.m\./);
  assert.match(PM.states.ny.hours["16"], /When school is not in session: up to 48 hours a week, and not between midnight and 6 a\.m\./);
});

test("states.html carries the same two New York sentences", () => {
  const html = fs.readFileSync(new URL("../states.html", import.meta.url), "utf8");
  assert.ok(html.includes("When school is closed: not between 9 p.m. and 7 a.m."));
  assert.ok(html.includes("When school is not in session: up to 48 hours a week, and not between midnight and 6 a.m."));
});

// A summer latest hour is stored as 24 hour clock numbers (21 is 9 p.m., 24 is midnight), so the text is checked in clock words.
function clockWords(n) {
  if (n === 24) return "midnight";
  if (n === 12) return "noon";
  if (n > 12) return `${n - 12} p.m.`;
  return `${n} a.m.`;
}

test("every latestSummer, offWeek and schoolWeek number in ca, ga, ny and il limits appears in that state's hours text", () => {
  for (const st of ["ca", "ga", "ny", "il"]) {
    const s = PM.states[st];
    for (const band of Object.keys(s.limits || {})) {
      const lim = s.limits[band];
      if (!lim) continue;
      const text = (s.hours[band] || "").toLowerCase();
      for (const key of ["latestSummer", "offWeek", "schoolWeek"]) {
        const v = lim[key];
        if (v == null) continue;
        if (key === "latestSummer") {
          assert.ok(text.includes(clockWords(v)), `${st} ${band} ${key} ${v} (${clockWords(v)}) not in hours text`);
        } else {
          assert.match(text, new RegExp(`\\b${v}\\b`), `${st} ${band} ${key} ${v} not in hours text`);
        }
      }
    }
  }
});
