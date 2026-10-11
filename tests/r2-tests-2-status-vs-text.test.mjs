// r2-tests-2: status must not contradict the plain words in deadline_text.
// Rule A: open-now, rolling or year-round text must not say the program is closed or not yet open.
// Rule B: closed-expect-reopen or unconfirmed text must not say registration is open, unless it is negated.
// Anything that matches must be in ALLOW with a reviewed reason. Stale ALLOW entries fail.
// Every failure names the id and the matching phrase. No clock, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "data/programs");
const PROGRAMS = readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

const A_STATUS = ["open-now", "rolling", "year-round"];
const B_STATUS = ["closed-expect-reopen", "unconfirmed"];
const A_RE = /no longer accepting|not accepting|is closed|are closed|has passed|have passed|not yet open|will open/i;
const B_RE = /now open|registration is open|currently open|accepting applications/i;
const NEGATION = /\bnot\b|\bno\b[^.]{0,30}\bopen/i;

export function scan(programs) {
  const out = []; // {key, msg}
  for (const p of programs) {
    const t = typeof p.deadline_text === "string" ? p.deadline_text : "";
    if (!t) continue;
    if (A_STATUS.includes(p.status)) {
      const m = A_RE.exec(t);
      if (m) out.push({ key: "A:" + p.id, msg: "A " + p.id + " (" + p.status + ") text says " + JSON.stringify(m[0]) });
    }
    if (B_STATUS.includes(p.status)) {
      const m = B_RE.exec(t);
      if (m && !NEGATION.test(t)) out.push({ key: "B:" + p.id, msg: "B " + p.id + " (" + p.status + ") text says " + JSON.stringify(m[0]) });
    }
  }
  return out;
}

/*
  Reviewed list. Each key is "<rule>:<program id>" with the reason the text and status do not conflict.
  When the data is fixed the entry goes stale and the "allow list is current" test fails: delete it.
*/
const ALLOW = {
  "A:after-school-matters-chicago": "the passed dates are for the Fall 2026 start; text says the apply page is still open with no close date",
  "A:champaign-illinois-arabic-high-school-program": "only the early admission date passed; the April 2027 deadlines are ahead",
  "A:college-park-umd-sparc-robotics-certificate": "text says the page does not say whether applications are closed; it shows a Dec 1, 2026 deadline",
  "A:cook-memorial-library-teen-volunteers": "the closed items are the Summer 2026 period and the Seed Library; Fall 2026 applications are open until Oct 15, 2026",
  "A:lansing-msu-dual-enrollment": "only the 2026 term deadlines passed; the Dec 19, 2026 deadline is ahead",
  "A:new-brunswick-franklin-township-library-teen-volunteering": "only Summer 2026 Reading Buddies is closed; the 2026-27 form is open",
  "A:san-diego-sharp-grossmont-junior-volunteer": "closed only to the class of 2028; classes of 2029 and 2030 may still apply",
  "A:seattle-ymca-youth-and-government-youth-legislature": "only the open house dates may have passed; delegations start Oct 19, 2026",
  "B:cincinnati-uc-early-it-summer-camp": "page says registration is open but gives no year; kept closed until the year is confirmed",
  "B:evanston-art-center-teen-board": "page says open but the board photo is from 2023-24; kept unconfirmed on purpose",
  "B:hire-las-youth": "banner says accepting but the site shows stale 2022 pages; kept unconfirmed until EWDD confirms",
  "B:sf-girls-on-the-run-junior-coach": "the open banner is for Spring 2027 site registration; the Fall 2026 Junior Coach application is closed",
};

const ALL = scan(PROGRAMS);

test("programs load", () => {
  assert.ok(PROGRAMS.length > 1000, "expected the per-program files, got " + PROGRAMS.length);
});

test("status does not contradict deadline_text (each failure names the id and phrase)", () => {
  const fresh = ALL.filter((x) => !(x.key in ALLOW)).map((x) => x.msg);
  assert.deepEqual(fresh, []);
});

test("allow list is current and every entry has a reason", () => {
  const live = new Set(ALL.map((x) => x.key));
  const stale = Object.keys(ALLOW).filter((k) => !live.has(k));
  assert.deepEqual(stale, [], "fixed, remove from ALLOW: " + stale.join(", "));
  const bare = Object.keys(ALLOW).filter((k) => !String(ALLOW[k]).trim());
  assert.deepEqual(bare, []);
});

test("seeded fixtures are caught, negation and other statuses are not", () => {
  const rows = scan([
    { id: "fx-a", status: "rolling", deadline_text: "We are no longer accepting applicants." },
    { id: "fx-a2", status: "open-now", deadline_text: "Applications will open in March." },
    { id: "fx-b", status: "closed-expect-reopen", deadline_text: "Registration is Now Open for camp." },
    { id: "fx-b2", status: "unconfirmed", deadline_text: "The site says it is accepting applications." },
    { id: "ok-neg", status: "closed-expect-reopen", deadline_text: "Registration is not currently open." },
    { id: "ok-neg2", status: "unconfirmed", deadline_text: "There is no date when registration is open." },
    { id: "ok-status", status: "closed-expect-reopen", deadline_text: "The form is closed." },
    { id: "ok-status2", status: "open-now", deadline_text: "Registration is now open." },
  ]);
  assert.deepEqual(rows.map((r) => r.key), ["A:fx-a", "A:fx-a2", "B:fx-b", "B:fx-b2"]);
  assert.match(rows[0].msg, /fx-a .*no longer accepting/);
  assert.match(rows[2].msg, /fx-b .*Now Open/);
});
