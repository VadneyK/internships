// 2026-10-15: tests that pin lib.js behavior the 2026-10-14 mutation run showed was untested (hoursCheck, permitFor, paycheck, place helpers).
// Run with: node --test tests/mut-c-lib.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const PERMITS = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

/* ---------- placeRegions (first, so the cache is cold for the copy test) ---------- */

test("placeRegions returns a copy: changing it does not change the CITIES table", () => {
  const before = JSON.stringify(L.CITIES);
  const r = L.placeRegions("city:merced");
  assert.deepEqual(r, ["merced", "statewide"]);
  r.push("junk");
  assert.equal(JSON.stringify(L.CITIES), before);
});

test("placeRegions: city, state and area ids resolve to exact region lists", () => {
  assert.deepEqual(L.placeRegions("city:san-francisco"), ["san-francisco", "statewide"]);
  // 2026-10-15: a whole state covers its state-level region first, then every city region in that state (STATE_OF order).
  assert.deepEqual(L.placeRegions("state:california"), ["statewide", "davis", "sacramento", "yolo", "silicon-valley", "san-jose", "peninsula", "fremont", "oakland", "berkeley", "alameda", "east-bay", "san-francisco", "orange-county", "los-angeles", "inland-empire", "san-diego", "santa-barbara", "merced"]);
  assert.deepEqual(L.placeRegions("state:ohio"), ["ohio", "columbus", "cincinnati"]);
  assert.deepEqual(L.placeRegions("state:utah"), ["utah"]);
  // bay-area = berkeley + san-francisco + silicon-valley, each listing "statewide": it appears once, first-seen order.
  assert.deepEqual(L.placeRegions("area:bay-area"),
    ["berkeley", "oakland", "alameda", "east-bay", "statewide", "san-francisco", "silicon-valley", "san-jose", "peninsula", "fremont"]);
});

test("placeRegions: the kind prefix must match the id table", () => {
  assert.equal(L.placeRegions("state:merced"), null);   // a city id used as a state
  assert.equal(L.placeRegions("city:ohio"), null);      // a state id used as a city
  assert.equal(L.placeRegions("area:merced"), null);
  assert.equal(L.placeRegions("area:ohio"), null);
  assert.equal(L.placeRegions("city:nowhere"), null);
  assert.equal(L.placeRegions("state:nowhere"), null);
  assert.equal(L.placeRegions("area:nowhere"), null);
  assert.equal(L.placeRegions("county:merced"), null);
  assert.equal(L.placeRegions("merced"), null);
  assert.equal(L.placeRegions(""), null);
  assert.equal(L.placeRegions(undefined), null);
  assert.equal(L.placeRegions(null), null);
});

test("placeRegions: repeat calls give the same answer", () => {
  assert.deepEqual(L.placeRegions("area:bay-area"), L.placeRegions("area:bay-area"));
  assert.equal(L.placeRegions("city:nowhere"), null);
  assert.equal(L.placeRegions("city:nowhere"), null);
});

test("placeRegions: every area lists each region once, and every area city exists", () => {
  for (const a of L.AREAS) {
    const r = L.placeRegions("area:" + a[0]);
    assert.ok(r.length > 0, a[0]);
    assert.equal(new Set(r).size, r.length, a[0] + " has a repeated region");
    for (const cid of a[2]) assert.ok(L.CITIES.some((c) => c[0] === cid), a[0] + " names unknown city " + cid);
  }
});

/* ---------- placeLabel ---------- */

test("placeLabel: exact labels per kind, empty string when unknown", () => {
  assert.equal(L.placeLabel("city:davis"), "Davis and Sacramento");
  assert.equal(L.placeLabel("state:california"), "California");
  assert.equal(L.placeLabel("state:british-columbia"), "British Columbia");
  assert.equal(L.placeLabel("area:bay-area"), "Bay Area");
  assert.equal(L.placeLabel("city:nowhere"), "");
  assert.equal(L.placeLabel("state:davis"), "");
  assert.equal(L.placeLabel("area:davis"), "");
  assert.equal(L.placeLabel("davis"), "");
  assert.equal(L.placeLabel(""), "");
  assert.equal(L.placeLabel(undefined), "");
  assert.equal(L.placeLabel("bogus:x"), "");
});

/* ---------- stateOf ---------- */

test("stateOf: first region that maps to a state wins; virtual and national map to none", () => {
  assert.equal(L.stateOf({ regions: ["davis"] }), "ca");
  assert.equal(L.stateOf({ regions: ["virtual", "atlanta"] }), "ga");
  assert.equal(L.stateOf({ regions: ["national", "virtual", "boston"] }), "ma");
  assert.equal(L.stateOf({ regions: ["atlanta", "davis"] }), "ga");
  assert.equal(L.stateOf({ regions: ["virtual"] }), "");
  assert.equal(L.stateOf({ regions: ["national"] }), "");
  assert.equal(L.stateOf({ regions: ["somewhere-new"] }), "");
  assert.equal(L.stateOf({ regions: [] }), "");
  assert.equal(L.stateOf({}), "");
});

test("stateOf: names inherited from Object.prototype are not regions", () => {
  assert.equal(L.stateOf({ regions: ["toString"] }), "");
  assert.equal(L.stateOf({ regions: ["constructor", "hasOwnProperty"] }), "");
  assert.equal(L.stateOf({ regions: ["__proto__"] }), "");
});

/* ---------- stateFromPlace ---------- */

test("stateFromPlace: one state for a single-state place, empty when unknown or crossing states", () => {
  assert.equal(L.stateFromPlace("state:california"), "ca");
  assert.equal(L.stateFromPlace("city:davis"), "ca");
  assert.equal(L.stateFromPlace("area:bay-area"), "ca");
  assert.equal(L.stateFromPlace("state:ohio"), "oh");
  assert.equal(L.stateFromPlace("city:seattle"), "wa");
  assert.equal(L.stateFromPlace("area:west-coast"), "");   // California, Washington and BC
  assert.equal(L.stateFromPlace("area:pacific-northwest"), "");
  assert.equal(L.stateFromPlace("city:nowhere"), "");
  assert.equal(L.stateFromPlace(""), "");
  assert.equal(L.stateFromPlace(undefined), "");
  assert.equal(L.stateFromPlace(null), "");
});

test("stateFromPlace: a non-string place is treated as unknown even if it looks like one", () => {
  assert.equal(L.stateFromPlace({ toString() { return "state:ohio"; } }), "");
  assert.equal(L.stateFromPlace(["state:ohio"]), "");
  assert.equal(L.stateFromPlace(42), "");
});

/* ---------- permitFor ---------- */

function permitData() {
  return {
    states: {
      xx: {
        name: "Xland", permit: "Work Card", needBelow: 17, adult: "ADULT TEXT", wage: "WAGE",
        minAge: { job: 14, note: "NOTE." },
        hours: { "12": "H12", "14": "H14", "16": "H16" },
        kinds: {
          job: { permit: true, text: "JOB TEXT" },
          program: { permit: true, text: "PROGRAM TEXT" },
          family: { permit: false, text: "FAMILY TEXT" },
          odd: { permit: false, text: "ODD TEXT" },
          vague: { permit: null, text: "VAGUE TEXT" },
          early: { permit: true, text: "EARLY TEXT", under: { below: 16, permit: false, text: "UNDER TEXT" } },
        },
      },
      yy: {
        name: "Yland", permit: "Employment Certificate", needBelow: 18, adult: "Y ADULT", wage: "Y WAGE",
        minAge: { job: 14, note: "Y NOTE." },
        hours: { "12": "", "14": "Y14", "16": "Y16" },
        kinds: { job: { permit: true, text: "Y JOB" } },
      },
    },
  };
}

test("permitFor: unknown state, missing data or inherited keys give the nostate answer", () => {
  const D = permitData();
  for (const [data, st] of [[D, "zz"], [D, "toString"], [D, "__proto__"], [D, undefined], [{}, "xx"], [null, "xx"], [undefined, "xx"], [{ states: null }, "xx"]]) {
    const r = L.permitFor(data, st, 16, "job");
    assert.equal(r.verdict, "nostate");
    assert.equal(r.headline, "We have not read your state yet");
    assert.match(r.text, /^We have full answers for 17 states and British Columbia, and shorter answers for 33 more states and Washington, DC\. /);
    assert.match(r.text, /dol\.gov\/agencies\/whd\/contact\/state-labor-offices\.$/);
  }
});

test("permitFor: unknown kind, missing kind or a bad age returns null", () => {
  const D = permitData();
  assert.equal(L.permitFor(D, "xx", 16, "nonsense"), null);
  assert.equal(L.permitFor(D, "xx", 16, "toString"), null);
  assert.equal(L.permitFor(D, "xx", 16, undefined), null);
  assert.equal(L.permitFor(D, "xx", NaN, "job"), null);
  assert.equal(L.permitFor(D, "xx", "abc", "job"), null);
  assert.equal(L.permitFor(D, "xx", -1, "job"), null);
  const noKinds = permitData(); delete noKinds.states.xx.kinds;
  assert.equal(L.permitFor(noKinds, "xx", 16, "job"), null);
});

test("permitFor: age 0 is a valid age (too young for a job), not an error", () => {
  const r = L.permitFor(permitData(), "xx", 0, "job");
  assert.equal(r.verdict, "young");
  assert.equal(r.age, 0);
  assert.equal(L.permitFor(permitData(), "xx", "0", "job").verdict, "young");
});

test("permitFor: need at 16 gives the permit name, kind text and base fields", () => {
  const r = L.permitFor(permitData(), "xx", 16, "job");
  assert.deepEqual(r, {
    state: "xx", stateName: "Xland", permit: "Work Card", kind: "job", age: 16, hours: "H16", wage: "WAGE",
    verdict: "need", headline: "You need a Work Card", text: "JOB TEXT",
  });
});

test("permitFor: the headline uses 'an' before a vowel and 'a' otherwise", () => {
  const D = permitData();
  assert.equal(L.permitFor(D, "xx", 15, "job").headline, "You need a Work Card");
  assert.equal(L.permitFor(D, "yy", 15, "job").headline, "You need an Employment Certificate");
  D.states.xx.permit = "umbrella card";
  assert.equal(L.permitFor(D, "xx", 15, "job").headline, "You need an umbrella card");
  D.states.xx.permit = "Zebra card";
  assert.equal(L.permitFor(D, "xx", 15, "job").headline, "You need a Zebra card");
});

test("permitFor: needBelow is the exact age where the permit stops being needed", () => {
  const D = permitData(); // needBelow 17
  assert.equal(L.permitFor(D, "xx", 16, "job").verdict, "need");
  const at17 = L.permitFor(D, "xx", 17, "job");
  assert.equal(at17.verdict, "none");
  assert.equal(at17.headline, "You do not need a permit at 17");
  assert.equal(at17.text, "ADULT TEXT");
});

test("permitFor: age 18 and up is adult, with the adult text and no hour band", () => {
  const r = L.permitFor(permitData(), "yy", 18, "job");
  assert.equal(r.verdict, "adult");
  assert.equal(r.headline, "You do not need a youth work permit");
  assert.equal(r.text, "Y ADULT");
  assert.equal(r.hours, "");
  assert.equal(L.permitFor(permitData(), "yy", 17, "job").verdict, "need");
});

test("permitFor: job, program and family are 'young' below the state's minimum job age", () => {
  const D = permitData();
  for (const kind of ["job", "program", "family"]) {
    const r = L.permitFor(D, "xx", 13, kind);
    assert.equal(r.verdict, "young", kind);
    assert.equal(r.headline, "Most paid jobs start at 14");
    assert.equal(r.text, "NOTE. See what you can do before 14.");
    assert.equal(r.hours, "", kind + " gets no hour row below the job age");
    assert.equal(r.wage, "WAGE");
    assert.notEqual(L.permitFor(D, "xx", 14, kind).verdict, "young", kind + " at 14");
  }
});

test("permitFor: other kinds under the job age still get an answer and the 12 to 13 hour row", () => {
  const D = permitData();
  const r = L.permitFor(D, "xx", 13, "odd");
  assert.equal(r.verdict, "none");
  assert.equal(r.headline, "You do not need a permit for this");
  assert.equal(r.text, "ODD TEXT");
  assert.equal(r.hours, "H12");
  assert.equal(L.permitFor(D, "xx", 12, "vague").hours, "H12");
  assert.equal(L.permitFor(D, "xx", 12, "vague").verdict, "ask");
});

test("permitFor: hour band by age: 11 none, 12 to 13, 14 to 15, 16 to 17", () => {
  const D = permitData();
  const h = (age) => L.permitFor(D, "xx", age, "odd").hours;
  assert.equal(h(11), "");
  assert.equal(h(12), "H12");
  assert.equal(h(13), "H12");
  assert.equal(h(14), "H14");
  assert.equal(h(15), "H14");
  assert.equal(h(16), "H16");
  assert.equal(h(17), "H16");
  assert.equal(L.permitFor(D, "xx", 17.5, "odd").hours, "H16");
  assert.equal(L.permitFor(D, "xx", "15", "odd").age, 15);
});

test("permitFor: a band with no hour text becomes an empty string, never undefined", () => {
  const D = permitData();
  delete D.states.xx.hours["14"];
  assert.equal(L.permitFor(D, "xx", 14, "odd").hours, "");
});

test("permitFor: permit false and permit null verdicts", () => {
  const D = permitData();
  const f = L.permitFor(D, "xx", 15, "family");
  assert.equal(f.verdict, "none");
  assert.equal(f.headline, "You do not need a permit for this");
  assert.equal(f.text, "FAMILY TEXT");
  const v = L.permitFor(D, "xx", 15, "vague");
  assert.equal(v.verdict, "ask");
  assert.equal(v.headline, "Check before you start");
  assert.equal(v.text, "VAGUE TEXT");
});

test("permitFor: a kind's 'under' override applies only below its age", () => {
  const D = permitData();
  const young = L.permitFor(D, "xx", 15, "early");
  assert.equal(young.verdict, "none");
  assert.equal(young.text, "UNDER TEXT");
  const at16 = L.permitFor(D, "xx", 16, "early");
  assert.equal(at16.verdict, "need");
  assert.equal(at16.text, "EARLY TEXT");
});

test("permitFor on real California data: 16 year old job, 13 year old job, adult", () => {
  const r = L.permitFor(PERMITS, "ca", 16, "job");
  assert.equal(r.verdict, "need");
  assert.equal(r.headline, "You need a Permit to Employ and Work");
  assert.equal(r.hours, PERMITS.states.ca.hours["16"]);
  assert.equal(L.permitFor(PERMITS, "ca", 13, "job").verdict, "young");
  assert.equal(L.permitFor(PERMITS, "ca", 18, "job").verdict, "adult");
});

/* ---------- hoursCheck ---------- */

const LIM = {
  "14": { schoolDay: 3, nonSchoolDay: 8, schoolWeek: 18, offWeek: 40, earliest: 7, latest: 19, latestSummer: 21 },
  "16": { schoolDay: 4, nonSchoolDay: 8, schoolWeek: 28, offWeek: 48, earliest: 5, latest: 22, latestSummer: null, lateNote: "ask a parent", lateMax: 24 },
};
const day = (from, to) => ({ from, to });
const none = [null, null, null, null, null, null, null];
const plan = (o) => { const a = none.slice(); for (const k in o) a[k] = o[k]; return a; };

test("hoursCheck: totals and per-day hours, and the result shape", () => {
  const r = L.hoursCheck(LIM, 16, true, plan({ 0: day(15, 18), 2: day(9, 12.5), 6: day(10, 11) }));
  assert.equal(r.total, 7.5);
  assert.deepEqual(r.perDay, [3, 0, 3.5, 0, 0, 0, 1]);
  assert.deepEqual(r.problems, []);
  assert.equal(r.limited, true);
  assert.equal("unconfirmed" in r, false);
});

test("hoursCheck: bad day entries count as zero hours", () => {
  const bad = [
    null, undefined, 0, "x",
    day("9", "12"), day(9, "12"), day(null, 12), day(-1, null), day(undefined, 12), day(9, undefined),
    day(NaN, 12), day(9, Infinity), day(12, 9), day(10, 10), day(),
  ];
  const r = L.hoursCheck(LIM, 16, false, bad);
  assert.equal(r.total, 0);
  assert.ok(r.perDay.every((h) => h === 0));
  assert.equal(r.perDay.length, bad.length);
  assert.deepEqual(r.problems, []);
});

test("hoursCheck: string and null times are not coerced to numbers", () => {
  assert.deepEqual(L.hoursCheck(LIM, 16, false, [day("9", 12)]).perDay, [0]);
  assert.deepEqual(L.hoursCheck(LIM, 16, false, [day(9, "12")]).perDay, [0]);
  assert.deepEqual(L.hoursCheck(LIM, 16, false, [day(null, 5)]).perDay, [0]);
  assert.deepEqual(L.hoursCheck(LIM, 16, false, [day(-1, null)]).perDay, [0]);
  assert.deepEqual(L.hoursCheck(LIM, 16, false, [day(9, 12)]).perDay, [3]);
});

test("hoursCheck: days that is not an array is treated as an empty plan", () => {
  for (const bad of [undefined, null, "mon", 5, { length: 7 }]) {
    const r = L.hoursCheck(LIM, 16, true, bad);
    assert.deepEqual(r, { total: 0, perDay: [], problems: [], limited: true });
  }
});

test("hoursCheck: no limits for 12 to 13, adults, missing limits or a missing band", () => {
  const p = plan({ 0: day(0, 23) });
  for (const [limits, age] of [[LIM, 13], [LIM, 12], [LIM, 18], [LIM, 30], [null, 16], [undefined, 16], [{}, 16], [{ "16": null }, 16], [LIM, "abc"]]) {
    const r = L.hoursCheck(limits, age, true, p);
    assert.equal(r.limited, false, JSON.stringify([limits && Object.keys(limits), age]));
    assert.deepEqual(r.problems, []);
    assert.equal(r.total, 23);
  }
});

test("hoursCheck: age bands, 15 uses the 14 row and 17 uses the 16 row", () => {
  const p = plan({ 0: day(15, 19) }); // 4 hours on a school day
  assert.equal(L.hoursCheck(LIM, 14, true, p).problems.length, 1);   // 14 limit is 3
  assert.equal(L.hoursCheck(LIM, 15, true, p).problems.length, 1);
  assert.equal(L.hoursCheck(LIM, 16, true, p).problems.length, 0);   // 16 limit is 4
  assert.equal(L.hoursCheck(LIM, 17, true, p).problems.length, 0);
  assert.equal(L.hoursCheck(LIM, "16", true, p).limited, true);
});

test("hoursCheck: daily hour limit message, at the limit is fine and over is flagged", () => {
  const ok = L.hoursCheck(LIM, 14, true, plan({ 0: day(15, 18) }));
  assert.deepEqual(ok.problems, []);
  const over = L.hoursCheck(LIM, 14, true, plan({ 0: day(15, 18.5) }));
  assert.deepEqual(over.problems, ["Monday: 3.5 hours is more than the 3 hour limit on a school day at 14."]);
  const off = L.hoursCheck(LIM, 14, false, plan({ 5: day(8, 17) }));
  assert.deepEqual(off.problems, ["Saturday: 9 hours is more than the 8 hour limit on a day off from school at 14."]);
});

test("hoursCheck: weekends are never school days; Friday is, unless weekdayOnly", () => {
  assert.deepEqual(L.hoursCheck(LIM, 14, true, plan({ 4: day(9, 14) })).problems,
    ["Friday: 5 hours is more than the 3 hour limit on a school day at 14."]);
  assert.deepEqual(L.hoursCheck(LIM, 14, true, plan({ 5: day(9, 14) })).problems, []);
  assert.deepEqual(L.hoursCheck(LIM, 14, true, plan({ 6: day(9, 14) })).problems, []);
  const wk = { "14": { ...LIM["14"], weekdayOnly: true } };
  assert.deepEqual(L.hoursCheck(wk, 14, true, plan({ 3: day(9, 14) })).problems,
    ["Thursday: 5 hours is more than the 3 hour limit on a school day at 14."]);
  assert.deepEqual(L.hoursCheck(wk, 14, true, plan({ 4: day(9, 18) })).problems,
    ["Friday: 9 hours is more than the 8 hour limit on a day off from school at 14."]);
});

test("hoursCheck: a missing daily limit means no daily problem", () => {
  const lim = { "16": { schoolDay: null, nonSchoolDay: null } };
  assert.deepEqual(L.hoursCheck(lim, 16, true, plan({ 0: day(0, 20) })).problems, []);
  assert.deepEqual(L.hoursCheck(lim, 16, false, plan({ 5: day(0, 20) })).problems, []);
  assert.deepEqual(L.hoursCheck({ "16": {} }, 16, true, plan({ 0: day(0, 20) })).problems, []);
});

test("hoursCheck: earliest start time", () => {
  const lim = { "14": { earliest: 7 } };
  assert.deepEqual(L.hoursCheck(lim, 14, true, plan({ 1: day(7, 9) })).problems, []);
  assert.deepEqual(L.hoursCheck(lim, 14, true, plan({ 1: day(6.5, 9) })).problems,
    ["Tuesday: starting before 7 a.m. is not allowed at 14."]);
  assert.deepEqual(L.hoursCheck({ "14": {} }, 14, true, plan({ 1: day(1, 3) })).problems, []);
});

test("hoursCheck: latest end time in p.m. and the summer limit when school is out", () => {
  const end = L.hoursCheck(LIM, 14, true, plan({ 2: day(17, 19.5) }));
  assert.deepEqual(end.problems, ["Wednesday: the end time is past the usual limit of 7 p.m. at 14."]);
  assert.deepEqual(L.hoursCheck(LIM, 14, true, plan({ 2: day(17, 19) })).problems, []);
  // school out: latestSummer 21 replaces latest 19
  assert.deepEqual(L.hoursCheck(LIM, 14, false, plan({ 2: day(17, 20) })).problems, []);
  assert.deepEqual(L.hoursCheck(LIM, 14, false, plan({ 2: day(17, 21.5) })).problems,
    ["Wednesday: the end time is past the usual limit of 9 p.m. at 14."]);
  // 16 has latestSummer null, so latest 22 applies in summer too
  assert.equal(L.hoursCheck(LIM, 16, false, plan({ 2: day(18, 22.5) })).problems.length, 1);
  assert.equal(L.hoursCheck(LIM, 16, false, plan({ 2: day(18, 22) })).problems.length, 0);
});

test("hoursCheck: latest limit written in the morning is shown as a.m.", () => {
  const lim = { "16": { latest: 6 } };
  assert.deepEqual(L.hoursCheck(lim, 16, true, plan({ 0: day(2, 7) })).problems,
    ["Monday: the end time is past the usual limit of 6 a.m. at 16."]);
});

test("hoursCheck: a late-night exception is mentioned only when the end is within lateMax", () => {
  const within = L.hoursCheck(LIM, 16, false, plan({ 0: day(18, 23.5) }));
  assert.deepEqual(within.problems,
    ["Monday: the end time is past the usual limit of 10 p.m. at 16. There is an exception: ask a parent."]);
  const atMax = L.hoursCheck(LIM, 16, false, plan({ 0: day(18, 24) }));
  assert.match(atMax.problems[0], /There is an exception: ask a parent\.$/);
  const beyond = L.hoursCheck(LIM, 16, false, plan({ 0: day(18, 24.5) }));
  assert.deepEqual(beyond.problems, ["Monday: the end time is past the usual limit of 10 p.m. at 16."]);
  // a note without lateMax, or lateMax without a note, adds nothing
  const noMax = { "16": { latest: 22, lateNote: "n" } };
  assert.equal(L.hoursCheck(noMax, 16, true, plan({ 0: day(18, 23) })).problems[0].includes("exception"), false);
  const noNote = { "16": { latest: 22, lateMax: 24 } };
  assert.equal(L.hoursCheck(noNote, 16, true, plan({ 0: day(18, 23) })).problems[0].includes("exception"), false);
  const emptyNote = { "16": { latest: 22, lateNote: "", lateMax: 24 } };
  assert.equal(L.hoursCheck(emptyNote, 16, true, plan({ 0: day(18, 23) })).problems[0].includes("exception"), false);
  const noLatest = { "16": {} };
  assert.deepEqual(L.hoursCheck(noLatest, 16, true, plan({ 0: day(0, 23) })).problems, []);
});

test("hoursCheck: weekly cap, in school and out of school", () => {
  const lim = { "14": { schoolWeek: 10, offWeek: 20 } };
  const p = plan({ 0: day(9, 13), 1: day(9, 13), 2: day(9, 13) }); // 12 hours
  assert.deepEqual(L.hoursCheck(lim, 14, true, p).problems,
    ["The week adds up to 12 hours, more than the 10 hour limit while school is in session at 14."]);
  assert.deepEqual(L.hoursCheck(lim, 14, false, p).problems, []);
  const big = plan({ 0: day(8, 18), 1: day(8, 18), 2: day(8, 18), 3: day(8, 18), 4: day(8, 18) }); // 50
  assert.deepEqual(L.hoursCheck(lim, 14, false, big).problems,
    ["The week adds up to 50 hours, more than the 20 hour limit when school is out at 14."]);
  // exactly at the cap is fine
  assert.deepEqual(L.hoursCheck({ "14": { schoolWeek: 12 } }, 14, true, p).problems, []);
  assert.equal(L.hoursCheck({ "14": { schoolWeek: 11.9 } }, 14, true, p).problems.length, 1);
  assert.deepEqual(L.hoursCheck({ "14": {} }, 14, true, p).problems, []);
});

test("hoursCheck: several problems on one day come in order: daily max, earliest, latest", () => {
  const r = L.hoursCheck({ "14": { schoolDay: 3, earliest: 7, latest: 19 } }, 14, true, plan({ 0: day(5, 21) }));
  assert.deepEqual(r.problems, [
    "Monday: 16 hours is more than the 3 hour limit on a school day at 14.",
    "Monday: starting before 7 a.m. is not allowed at 14.",
    "Monday: the end time is past the usual limit of 7 p.m. at 14.",
  ]);
});

test("hoursCheck: unconfirmed limits tag every problem and set the flag", () => {
  const lim = { "14": { ...LIM["14"], unconfirmed: true } };
  const r = L.hoursCheck(lim, 14, true, plan({ 0: day(15, 19) }));
  assert.equal(r.unconfirmed, true);
  assert.deepEqual(r.problems, ["Monday: 4 hours is more than the 3 hour limit on a school day at 14. We could not confirm this limit, so check the card."]);
  const clean = L.hoursCheck(lim, 14, true, plan({ 0: day(15, 17) }));
  assert.equal(clean.unconfirmed, true);
  assert.deepEqual(clean.problems, []);
});

test("hoursCheck on real California data: a 15 year old working 4 hours after school", () => {
  const lim = PERMITS.states.ca.limits;
  const r = L.hoursCheck(lim, 15, true, plan({ 0: day(15, 19) }));
  assert.deepEqual(r.problems, ["Monday: 4 hours is more than the 3 hour limit on a school day at 15."]);
  assert.deepEqual(L.hoursCheck(lim, 16, true, plan({ 0: day(15, 19) })).problems, []);
});

/* ---------- paycheck ---------- */

const MONEY = {
  rates: { ss: 0.062, medicare: 0.0145, sdi: 0.013, pfl: 0.00432, nyDisabilityRate: 0.005, nyDisabilityWeekCap: 0.6 },
  presets: [
    { id: "plain", state: "xx", extra: [] },
    { id: "ca", state: "ca", extra: ["sdi"] },
    { id: "ny", state: "ny", extra: ["pfl"] },
  ],
};

test("paycheck: plain preset, exact lines and take-home for $16 x 10 hours", () => {
  const r = L.paycheck(MONEY, "plain", 16, 10);
  assert.deepEqual(r, {
    gross: 160,
    lines: [
      { key: "ss", label: "Social Security", amount: 9.92 },
      { key: "medicare", label: "Medicare", amount: 2.32 },
    ],
    left: 147.76, state: "xx", parentBiz: false,
  });
});

test("paycheck: California adds SDI with its label", () => {
  const r = L.paycheck(MONEY, "ca", 16, 10);
  assert.deepEqual(r.lines.map((l) => [l.key, l.label, l.amount]),
    [["ss", "Social Security", 9.92], ["medicare", "Medicare", 2.32], ["sdi", "California SDI", 2.08]]);
  assert.equal(r.left, 145.68);
  assert.equal(r.state, "ca");
  assert.equal("possibleDisability" in r, false);
});

test("paycheck: New York adds Paid Family Leave and a capped possible disability figure", () => {
  const r = L.paycheck(MONEY, "ny", 16, 10);
  assert.deepEqual(r.lines.map((l) => [l.key, l.label, l.amount]),
    [["ss", "Social Security", 9.92], ["medicare", "Medicare", 2.32], ["pfl", "NY Paid Family Leave", 0.69]]);
  assert.equal(r.left, 147.07);
  assert.equal(r.possibleDisability, 0.6);         // 0.5% of 160 is 0.80, capped at 0.60
  const small = L.paycheck(MONEY, "ny", 10, 10);   // 0.5% of 100 is 0.50, under the cap
  assert.equal(small.possibleDisability, 0.5);
});

test("paycheck: a parent's business skips Social Security and Medicare", () => {
  const r = L.paycheck(MONEY, "ca", 16, 10, true);
  assert.equal(r.parentBiz, true);
  assert.deepEqual(r.lines, [{ key: "sdi", label: "California SDI", amount: 2.08 }]);
  assert.equal(r.left, 157.92);
  const plain = L.paycheck(MONEY, "plain", 16, 10, true);
  assert.deepEqual(plain.lines, []);
  assert.equal(plain.left, 160);
  assert.equal(L.paycheck(MONEY, "plain", 16, 10, 1).parentBiz, true);
  assert.equal(L.paycheck(MONEY, "plain", 16, 10, undefined).parentBiz, false);
});

test("paycheck: each tax is rounded to the cent on its own line", () => {
  // 10 x 1.15 = 11.5 gross; ss 0.713 -> 0.71; medicare 0.16675 -> 0.17; left 10.62
  const r = L.paycheck(MONEY, "plain", 1.15, 10);
  assert.equal(r.gross, 11.5);
  assert.deepEqual(r.lines.map((l) => l.amount), [0.71, 0.17]);
  assert.equal(r.left, 10.62);
  // one cent of pay: taxes round to 0, take-home keeps the cent
  const tiny = L.paycheck(MONEY, "plain", 0.01, 1);
  assert.equal(tiny.gross, 0.01); assert.equal(tiny.left, 0.01);
});

test("paycheck: unknown preset, blank, missing or invalid wage and hours give null", () => {
  assert.equal(L.paycheck(MONEY, "nope", 16, 10), null);
  for (const [w, h] of [["", 10], [16, ""], [null, 10], [16, null], [undefined, 10], [16, undefined], [-1, 10], [16, -1], ["abc", 10], [16, "abc"], [Infinity, 10], [16, Infinity], [NaN, 10]]) {
    assert.equal(L.paycheck(MONEY, "plain", w, h), null, JSON.stringify([w, h]));
  }
});

test("paycheck: numeric strings from form fields work, zero is a valid answer", () => {
  assert.equal(L.paycheck(MONEY, "plain", "16", "10").gross, 160);
  const z = L.paycheck(MONEY, "plain", 0, 0);
  assert.equal(z.gross, 0); assert.equal(z.left, 0);
});
