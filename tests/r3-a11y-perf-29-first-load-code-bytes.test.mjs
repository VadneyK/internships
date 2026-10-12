// First-load code weight per built root page. A page's total is the byte size on disk of every
// <script src> and <link rel="stylesheet"> it names. Each page has a ceiling about 5% over today's size.
// Going over a ceiling fails the test: add the weight on purpose and raise the row, with a reason.
// Also checks that lib.js loads only where a script uses it, and that no script tag points at an external http(s) URL.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB_NAMES = /\b(?:G|TIG)\.(?:esc|safeUrl|parseISO|fmtDate|daysUntil|lib|fillPlaces|placeTiles|REGIONS|HUBS|TYPES|FIELDS|PAID)\b/;
const PICKER_CALLS = /\b(?:G|TIG)\.(?:tilePicker|autoTiles)\b/;

// Ceilings: bytes on disk for each page's script and stylesheet files, about 5% over today's total (rounded up to 100 bytes).
const BUDGET = {
  "404.html": { ceiling: 71800, reason: "common.js and both stylesheets only; no page script" },
  "about.html": { ceiling: 71800, reason: "common.js and both stylesheets only; no page script" },
  "calendar.html": { ceiling: 129900, reason: "lib.js, common.js and calendar.js" },
  "contribute.html": { ceiling: 71800, reason: "common.js and both stylesheets only; no page script" },
  "find.html": { ceiling: 170500, reason: "lib.js, common.js and find.js (largest page script)" },
  "handout.html": { ceiling: 72100, reason: "common.js, handout.js and both stylesheets; no lib.js" },
  "index.html": { ceiling: 131800, reason: "lib.js, common.js and home.js" },
  "insights.html": { ceiling: 127300, reason: "lib.js, common.js and insights.js" },
  "interview.html": { ceiling: 140900, reason: "lib.js, common.js and interview.js" },
  "jobs.html": { ceiling: 138200, reason: "lib.js, common.js and jobs.js" },
  "languages.html": { ceiling: 125300, reason: "lib.js, common.js and languages.js" },
  "leaders.html": { ceiling: 79500, reason: "common.js, leaders.js and both stylesheets; no lib.js" },
  "parents.html": { ceiling: 125200, reason: "lib.js, common.js and parents.js" },
  "paycheck.html": { ceiling: 131800, reason: "lib.js, common.js and paycheck.js" },
  // Raised from 139900 to 141000 on 2026-10-11 when the third upgrade round was merged: permit.js grew by 716 bytes and the page is 140932 bytes.
  // Raised from 141000 to 142300 on 2026-10-11 for ticket p6-permit-1: the age line on the shorter state answer (about 1,300 bytes in permit.js) and the shared G.stateShorts() reader in common.js (about 300 bytes, which jobs.js and younger.js now share instead of each fetching the file). The page is 142229 bytes.
  // Raised from 142300 to 142500 on 2026-10-11 after the persona round 4 merge: permit.html loads 142397 bytes of code (a 97 byte overage that came from combining the two lines of work).
  "permit.html": { ceiling: 142500, reason: "lib.js, common.js and permit.js" },
  "playbook.html": { ceiling: 139700, reason: "lib.js, common.js and playbook.js" },
  "ready.html": { ceiling: 133000, reason: "lib.js, common.js and ready.js" },
  "resume.html": { ceiling: 130000, reason: "lib.js, common.js and resume.js" },
  "rules.html": { ceiling: 71800, reason: "common.js and both stylesheets only; no page script" },
  "safety.html": { ceiling: 127600, reason: "lib.js, common.js and safety.js" },
  "share.html": { ceiling: 73500, reason: "common.js, share.js and both stylesheets; no lib.js" },
  "states.html": { ceiling: 123900, reason: "lib.js, common.js and states.js" },
  "younger.html": { ceiling: 130800, reason: "lib.js, common.js and younger.js" },
};

function builtPages() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
}
function readPage(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}
// Returns the raw src/href values of every script and stylesheet link a page names.
function assetRefs(html) {
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
  const styles = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((m) => m[1]);
  return { scripts, styles };
}
// Maps a page reference such as "assets/js/lib.js?v=abc" or "/internships/assets/css/style.css?v=abc" to a repo path.
function localPath(ref) {
  return ref.replace(/[?#].*$/, "").replace(/^\/internships\//, "").replace(/^\/+/, "");
}
function bytesOf(ref) {
  const rel = localPath(ref);
  const abs = path.join(ROOT, rel);
  assert.ok(fs.existsSync(abs), "referenced file is missing on disk: " + rel);
  return fs.statSync(abs).size;
}
function ownScriptNames(scripts) {
  return scripts
    .map((s) => localPath(s))
    .filter((p) => p.startsWith("assets/js/") && p.endsWith(".js"))
    .map((p) => path.basename(p, ".js"))
    .filter((n) => n !== "common" && n !== "lib");
}
function hasShareParent(html) {
  return [...html.matchAll(/<[^>]+>/g)].some((m) => /\bclass="[^"]*\bshare-parent\b/.test(m[0]) && /\sdata-share=/.test(m[0]));
}
function needsLib(html, scripts) {
  const ownText = ownScriptNames(scripts)
    .map((s) => fs.readFileSync(path.join(ROOT, "assets", "js", s + ".js"), "utf8"))
    .join("\n");
  return LIB_NAMES.test(ownText) || PICKER_CALLS.test(ownText) || hasShareParent(html) || /\sdata-tiles(\s|=|>)/.test(html);
}
function pageTotal(file) {
  const { scripts, styles } = assetRefs(readPage(file));
  return [...scripts, ...styles].reduce((sum, ref) => sum + bytesOf(ref), 0);
}

test("every built root page has a budget row, and every budget row names a built page", () => {
  const pages = builtPages();
  const missing = pages.filter((p) => !Object.prototype.hasOwnProperty.call(BUDGET, p));
  const stale = Object.keys(BUDGET).filter((p) => !pages.includes(p));
  assert.deepEqual(missing, [], "built pages with no row in BUDGET");
  assert.deepEqual(stale, [], "BUDGET rows for pages that no longer exist");
  for (const [page, row] of Object.entries(BUDGET)) {
    assert.ok(Number.isInteger(row.ceiling) && row.ceiling > 0, page + " ceiling must be a positive integer");
    assert.ok(typeof row.reason === "string" && row.reason.trim().length > 0, page + " needs a reason");
  }
});

test("each built page's script and stylesheet bytes stay under its ceiling", () => {
  const over = [];
  for (const page of builtPages()) {
    if (!BUDGET[page]) continue;
    const total = pageTotal(page);
    if (total > BUDGET[page].ceiling) {
      over.push(`${page}: ${total} bytes, ceiling ${BUDGET[page].ceiling} (${BUDGET[page].reason})`);
    }
  }
  assert.deepEqual(over, [], "pages over their first-load byte ceiling");
});

test("pages with no script of their own load only common.js and the two stylesheets, under the lib.js pages", () => {
  const libCeilings = [];
  const plainCeilings = [];
  for (const page of builtPages()) {
    const { scripts, styles } = assetRefs(readPage(page));
    const own = ownScriptNames(scripts);
    if (!BUDGET[page]) continue;
    if (scripts.some((s) => /assets\/js\/lib\.js/.test(s))) libCeilings.push(BUDGET[page].ceiling);
    if (own.length === 0) {
      assert.deepEqual(scripts.map(localPath), ["assets/js/common.js"], page + " should load only common.js");
      assert.equal(styles.length, 2, page + " should load exactly two stylesheets");
      plainCeilings.push([page, BUDGET[page].ceiling]);
    }
  }
  assert.ok(plainCeilings.length >= 3, "expected several pages with no script of their own");
  const lowestLib = Math.min(...libCeilings);
  for (const [page, ceiling] of plainCeilings) {
    assert.ok(ceiling < lowestLib, `${page} ceiling ${ceiling} should sit below every lib.js page (lowest ${lowestLib})`);
  }
});

test("no built page loads lib.js without a script that uses it", () => {
  const bad = [];
  for (const page of builtPages()) {
    const html = readPage(page);
    const { scripts } = assetRefs(html);
    const loadsLib = scripts.some((s) => localPath(s) === "assets/js/lib.js");
    if (loadsLib && !needsLib(html, scripts)) {
      bad.push(page + " loads lib.js but none of its scripts use lib names, share-parent or tap tiles");
    }
  }
  assert.deepEqual(bad, []);
});

test("no built page has a script tag with an external http(s) src", () => {
  const bad = [];
  for (const page of builtPages()) {
    const { scripts } = assetRefs(readPage(page));
    for (const s of scripts) {
      if (/^https?:\/\//i.test(s) || /^\/\//.test(s)) bad.push(page + " loads " + s);
    }
  }
  assert.deepEqual(bad, []);
});
