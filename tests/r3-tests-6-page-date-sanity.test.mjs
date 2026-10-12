// Prose date sanity for every built root page. Scans "Month D, YYYY" and
// "Weekday, Month D, YYYY" (and "Month D" with no year) in the visible text of each
// root .html file, with scripts, styles and comments removed. A full date must be a
// real calendar day, a named weekday must match that date, and the year must be
// 2025 to 2028 unless the exact string is on YEAR_ALLOWLIST with a reason.
// Plain node, no network, no browser. Nothing is edited by this test.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Longest possible day count per month (February allows 29; a real leap year is checked below).
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MIN_YEAR = 2025;
const MAX_YEAR = 2028;

// Exact date strings that may use a year outside MIN_YEAR to MAX_YEAR. Key is "page.html|exact string".
// Empty today: every full date on the built pages is in 2025 to 2028.
const YEAR_ALLOWLIST = {};

const DATE_RE = new RegExp(
  "(?:\\b(" + WEEKDAYS.join("|") + "),?\\s+)?" +
  "\\b(" + MONTHS.join("|") + ")\\s+(\\d{1,2})\\b" +
  "(?:,\\s*(\\d{4})\\b)?",
  "g",
);

export function stripForScan(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/&nbsp;|&#160;/gi, " ");
}

// Returns a list of problem strings, each naming the page, the exact text and the reason.
export function checkText(page, html) {
  const problems = [];
  const text = stripForScan(html);
  for (const m of text.matchAll(DATE_RE)) {
    const [whole, weekday, monthName, dayStr, yearStr] = m;
    const label = whole.trim();
    const month = MONTHS.indexOf(monthName);
    const day = Number(dayStr);
    if (yearStr === undefined) {
      // No year, so the weekday cannot be checked. The day must still exist in that month.
      if (day < 1 || day > MAX_DAY[month]) {
        problems.push(`${page}: "${label}" is not a real day (${monthName} has at most ${MAX_DAY[month]} days)`);
      }
      continue;
    }
    const year = Number(yearStr);
    const allowed = Object.prototype.hasOwnProperty.call(YEAR_ALLOWLIST, `${page}|${label}`);
    if ((year < MIN_YEAR || year > MAX_YEAR) && !allowed) {
      problems.push(`${page}: "${label}" has year ${year}, outside ${MIN_YEAR} to ${MAX_YEAR}`);
    }
    const d = new Date(Date.UTC(year, month, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) {
      problems.push(`${page}: "${label}" is not a real calendar day`);
      continue;
    }
    if (weekday !== undefined) {
      const actual = WEEKDAYS[d.getUTCDay()];
      if (actual !== weekday) {
        problems.push(`${page}: "${label}" names ${weekday}, but that date is a ${actual}`);
      }
    }
  }
  return problems;
}

function rootPages() {
  return fs.readdirSync(ROOT)
    .filter((f) => f.endsWith(".html"))
    .sort();
}

test("built root pages: every full date is a real day, weekdays match, years are 2025 to 2028", () => {
  const pages = rootPages();
  assert.ok(pages.length >= 20, `expected the built root pages, found ${pages.length}`);
  const problems = [];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(ROOT, page), "utf8");
    problems.push(...checkText(page, html));
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("YEAR_ALLOWLIST entries each carry a non-empty reason", () => {
  for (const [key, reason] of Object.entries(YEAR_ALLOWLIST)) {
    assert.equal(typeof reason, "string", `${key} needs a reason string`);
    assert.ok(reason.trim().length > 0, `${key} needs a non-empty reason`);
  }
});

test("seeded bad strings fail the same checker", () => {
  const impossible = checkText("seed.html", "<p>The card is due February 30, 2027.</p>");
  assert.ok(
    impossible.some((p) => p.includes("February 30, 2027") && p.includes("not a real calendar day")),
    `expected an impossible-day failure, got: ${JSON.stringify(impossible)}`,
  );

  const weekday = checkText("seed.html", "<p>Opens Monday, March 5, 2027.</p>");
  assert.ok(
    weekday.some((p) => p.includes("Monday, March 5, 2027") && p.includes("Friday")),
    `expected a weekday mismatch naming Friday, got: ${JSON.stringify(weekday)}`,
  );

  const year = checkText("seed.html", "<p>Ends June 30, 2019.</p>");
  assert.ok(
    year.some((p) => p.includes("June 30, 2019") && p.includes("outside 2025 to 2028")),
    `expected a year failure, got: ${JSON.stringify(year)}`,
  );

  const noYear = checkText("seed.html", "<p>Open February 30 to March 2.</p>");
  assert.ok(
    noYear.some((p) => p.includes("February 30") && p.includes("not a real day")),
    `expected an impossible day with no year, got: ${JSON.stringify(noYear)}`,
  );
});

test("correct dates pass, and dates inside scripts or comments are ignored", () => {
  const good = checkText(
    "seed.html",
    "<p>Friday, March 5, 2027 and February 29, 2028 and June 30, 2027 and October 9, 2026.</p>",
  );
  assert.deepEqual(good, []);

  const hidden = checkText(
    "seed.html",
    "<script>var s = 'February 30, 2027';</script><!-- Monday, March 5, 2027 --><style>p::after{content:'June 31, 2027'}</style>",
  );
  assert.deepEqual(hidden, []);
});
