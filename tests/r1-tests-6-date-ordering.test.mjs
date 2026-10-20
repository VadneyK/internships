// r1-tests-6 (date ordering): relations between dates that single-field tests do not see.
// Covers: opens_iso is not after deadline_iso; verified_on parses and is not after the meta or calendar
// read stamp (plus one day of slack); deadline_iso, when set, falls in 2025 to 2028; sitemap lastmod values
// parse and are not after meta's build date; every root page has a sitemap entry.
// Already enforced elsewhere and not repeated here: status vs deadline (r1-tests-2), strict verified_on vs
// meta.checked and checked vs newest verified_on (r3-tests-8), sitemap pages vs files (r1-tests-1).
// Plain node, no network, no real clock. Every failure names the program id or the sitemap URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const L = createRequire(import.meta.url)(path.join(ROOT, "assets/js/lib.js"));
const readJSON = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const META = readJSON("data/meta.json");
const CAL = readJSON("data/calendar.json");
const PROGRAMS_DIR = path.join(ROOT, "data/programs");
const PROGRAMS = fs.readdirSync(PROGRAMS_DIR).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ file: f, p: JSON.parse(fs.readFileSync(path.join(PROGRAMS_DIR, f), "utf8")) }));
const SITE = "https://vadneyk.github.io/internships/";

const SLACK_DAYS = 1;
const DEADLINE_MIN = "2025-01-01";
const DEADLINE_MAX = "2028-12-31";
const MONTH = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

// ---------- allow lists: each entry needs a reason; an entry that no longer matches fails as stale ----------

// Program id -> reason. Empty: no program today has opens_iso after deadline_iso.
const OPENS_AFTER_DEADLINE = {};
// Program id -> reason. Empty: every deadline_iso is inside 2025 to 2028 today.
const DEADLINE_OUT_OF_RANGE = {};
// Program id -> reason. Empty: no verified_on is later than the read stamps plus slack today.
const VERIFIED_AFTER_STAMP = {};
// Sitemap URL -> reason. Empty: every lastmod is on or before meta's build date today.
const LASTMOD_AFTER_BUILD = {};
// Root page file -> reason. These pages are kept out of the sitemap on purpose.
const ROOT_NOT_IN_SITEMAP = {
  "404.html": "error page, not a destination",
  "leaders.html": "noindex and unlisted on purpose (tools/build.py keeps it out until approved)",
  "ignition.html": "noindex and unlisted on purpose until Ignition's leaders approve promoting it (tools/build.py keeps it out, 2026-10-20)",
};

// ---------- pure helpers ----------

// Returns a YYYY-MM-DD string n days after an ISO day, using UTC day arithmetic so no time zone shifts it.
function addDaysISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// "Oct 9, 2026" (the calendar read stamp) to "2026-10-09", or null when it does not parse.
function readStampToISO(s) {
  const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(String(s || ""));
  if (!m || !(m[1] in MONTH)) return null;
  const iso = `${m[3]}-${String(MONTH[m[1]]).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`;
  return L.parseISO(iso) ? iso : null;
}

// The latest day any read stamp (meta build date, calendar read) records.
function stampBound(meta, cal) {
  const days = [meta.checked, readStampToISO(cal.read)].filter((x) => L.parseISO(x || ""));
  return days.sort().pop() || "";
}

// Date-relation violations for one program file. Returns [{ id, rule, msg }].
function programDateProblems(p, bound) {
  const out = [];
  const add = (rule, msg) => out.push({ id: p.id, rule, msg });
  const { opens_iso: opens, deadline_iso: deadline, verified_on: verified } = p;

  if (opens != null && deadline != null) {
    if (!L.parseISO(opens)) add("bad-opens", `opens_iso ${JSON.stringify(opens)} does not parse`);
    else if (!L.parseISO(deadline)) add("bad-deadline", `deadline_iso ${JSON.stringify(deadline)} does not parse`);
    else if (opens > deadline) add("opens-after-deadline", `opens_iso ${opens} is after deadline_iso ${deadline}`);
  }
  if (deadline != null) {
    if (!L.parseISO(deadline)) add("bad-deadline", `deadline_iso ${JSON.stringify(deadline)} does not parse`);
    else if (deadline < DEADLINE_MIN || deadline > DEADLINE_MAX) {
      add("deadline-out-of-range", `deadline_iso ${deadline} is outside ${DEADLINE_MIN} to ${DEADLINE_MAX}`);
    }
  }
  if (!L.parseISO(verified || "")) add("bad-verified", `verified_on ${JSON.stringify(verified)} does not parse`);
  else if (bound && verified > addDaysISO(bound, SLACK_DAYS)) {
    add("verified-after-stamp", `verified_on ${verified} is more than ${SLACK_DAYS} day after ${bound}`);
  }
  return out;
}

// Sitemap checks. entries: [{ loc, lastmod }] parsed from sitemap.xml. rootPages: root *.html file names.
function sitemapProblems(entries, rootPages, checked) {
  const out = [];
  const listed = new Set();
  for (const { loc, lastmod } of entries) {
    if (!L.parseISO(lastmod || "")) out.push({ id: loc, rule: "bad-lastmod", msg: `lastmod ${JSON.stringify(lastmod)} does not parse` });
    else if (checked && lastmod > checked) out.push({ id: loc, rule: "lastmod-after-build", msg: `lastmod ${lastmod} is after meta build date ${checked}` });
    const rel = loc.startsWith(SITE) ? loc.slice(SITE.length) : null;
    if (rel !== null) listed.add(rel === "" ? "index.html" : rel);
  }
  for (const f of rootPages) {
    if (!listed.has(f) && !(f in ROOT_NOT_IN_SITEMAP)) out.push({ id: f, rule: "root-page-no-lastmod", msg: `${f} has no sitemap entry` });
  }
  return out;
}

// Runs the allow-list gate. Fresh violations must be allowed; every allow entry must still match.
function gate(label, violations, allow) {
  const fresh = violations.filter((v) => !(v.id in allow)).map((v) => `${v.rule} ${v.id}: ${v.msg}`);
  const live = new Set(violations.map((v) => v.id));
  const stale = Object.keys(allow).filter((k) => !live.has(k));
  assert.deepEqual(fresh, [], `${label}: new violations`);
  assert.deepEqual(stale, [], `${label}: allow list entries that no longer match, remove them`);
}

function sitemapEntries(xml) {
  return [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g)]
    .map((m) => ({ loc: m[1].trim(), lastmod: m[2].trim() }));
}

const BOUND = stampBound(META, CAL);
const PROGRAM_PROBLEMS = PROGRAMS.flatMap(({ p }) => programDateProblems(p, BOUND));
const SITEMAP_XML = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const SITEMAP = sitemapEntries(SITEMAP_XML);
const ROOT_HTML = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// ---------- live data ----------

test("data/programs loads and the meta and calendar read stamps give a usable bound", () => {
  assert.ok(PROGRAMS.length > 1000, `expected the per-program files, got ${PROGRAMS.length}`);
  assert.ok(L.parseISO(BOUND), `the read stamps give no usable bound: ${BOUND}`);
});

test("opens_iso is never after deadline_iso (when both are set)", () => {
  const v = PROGRAM_PROBLEMS.filter((x) => x.rule === "opens-after-deadline" || x.rule === "bad-opens" || x.rule === "bad-deadline");
  gate("opens/deadline order", v.filter((x) => x.rule === "opens-after-deadline"), OPENS_AFTER_DEADLINE);
  assert.deepEqual(v.filter((x) => x.rule !== "opens-after-deadline").map((x) => `${x.rule} ${x.id}: ${x.msg}`), [], "bad date text");
});

test("verified_on parses and is not more than one day after the meta or calendar read stamp", () => {
  const v = PROGRAM_PROBLEMS.filter((x) => x.rule === "verified-after-stamp" || x.rule === "bad-verified");
  gate("verified_on vs stamps", v.filter((x) => x.rule === "verified-after-stamp"), VERIFIED_AFTER_STAMP);
  assert.deepEqual(v.filter((x) => x.rule === "bad-verified").map((x) => `${x.id}: ${x.msg}`), [], "verified_on does not parse");
});

test("deadline_iso, when set, is a real date between 2025-01-01 and 2028-12-31", () => {
  const v = PROGRAM_PROBLEMS.filter((x) => x.rule === "deadline-out-of-range" || x.rule === "bad-deadline");
  gate("deadline range", v.filter((x) => x.rule === "deadline-out-of-range"), DEADLINE_OUT_OF_RANGE);
  assert.deepEqual(v.filter((x) => x.rule === "bad-deadline").map((x) => `${x.id}: ${x.msg}`), [], "deadline_iso does not parse");
});

test("every sitemap lastmod parses and is not after meta's build date", () => {
  assert.ok(SITEMAP.length > 0, "sitemap.xml has no url entries");
  const v = sitemapProblems(SITEMAP, [], META.checked).filter((x) => x.rule === "lastmod-after-build" || x.rule === "bad-lastmod");
  gate("sitemap lastmod", v.filter((x) => x.rule === "lastmod-after-build"), LASTMOD_AFTER_BUILD);
  assert.deepEqual(v.filter((x) => x.rule === "bad-lastmod").map((x) => `${x.id}: ${x.msg}`), [], "lastmod does not parse");
});

test("every root html page has a sitemap entry with a lastmod, except the reasoned exceptions", () => {
  const v = sitemapProblems(SITEMAP, ROOT_HTML, META.checked).filter((x) => x.rule === "root-page-no-lastmod");
  assert.deepEqual(v.map((x) => x.msg), [], "root pages missing from the sitemap");
  const stale = Object.keys(ROOT_NOT_IN_SITEMAP).filter((f) => !ROOT_HTML.includes(f) || SITEMAP.some((e) => e.loc === SITE + f));
  assert.deepEqual(stale, [], "ROOT_NOT_IN_SITEMAP entries that no longer apply, remove them");
});

test("allow lists carry a reason for every entry", () => {
  for (const allow of [OPENS_AFTER_DEADLINE, DEADLINE_OUT_OF_RANGE, VERIFIED_AFTER_STAMP, LASTMOD_AFTER_BUILD, ROOT_NOT_IN_SITEMAP]) {
    for (const [k, why] of Object.entries(allow)) assert.ok(typeof why === "string" && why.trim().length > 0, `${k} needs a reason`);
  }
});

// ---------- seeded fixtures: prove each rule really fires ----------

const GOOD = { id: "fx-good", opens_iso: "2027-01-10", deadline_iso: "2027-02-01", verified_on: "2026-10-09" };
const FX_BOUND = "2026-10-10";
const rulesOf = (p) => programDateProblems(p, FX_BOUND).map((x) => x.rule);

test("fixture: a clean program has no date problems", () => {
  assert.deepEqual(rulesOf(GOOD), []);
});

test("fixture: opens after deadline is caught, equal days are allowed", () => {
  assert.deepEqual(rulesOf({ ...GOOD, opens_iso: "2027-02-02" }), ["opens-after-deadline"]);
  assert.deepEqual(rulesOf({ ...GOOD, opens_iso: "2027-02-01" }), []);
});

test("fixture: verified_on one day after the stamp passes, two days fails", () => {
  assert.deepEqual(rulesOf({ ...GOOD, verified_on: "2026-10-11" }), []);
  assert.deepEqual(rulesOf({ ...GOOD, verified_on: "2026-10-12" }), ["verified-after-stamp"]);
});

test("fixture: impossible dates and out-of-window deadlines are caught", () => {
  const noOpens = { ...GOOD, opens_iso: null };
  assert.deepEqual(rulesOf({ ...GOOD, verified_on: "2026-02-30" }), ["bad-verified"]);
  assert.deepEqual(rulesOf({ ...noOpens, deadline_iso: "2024-12-31" }), ["deadline-out-of-range"]);
  assert.deepEqual(rulesOf({ ...noOpens, deadline_iso: "2029-01-01" }), ["deadline-out-of-range"]);
});

test("fixture: sitemap lastmod after build and a missing root page are caught", () => {
  const entries = [{ loc: SITE, lastmod: "2026-10-10" }, { loc: SITE + "find.html", lastmod: "2026-10-11" }];
  const rules = sitemapProblems(entries, ["index.html", "find.html", "about.html", "404.html"], "2026-10-10").map((x) => x.rule);
  assert.deepEqual(rules.sort(), ["lastmod-after-build", "root-page-no-lastmod"]);
});
