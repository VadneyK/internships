// Size ratchet: every data/*.json, assets/css/*.css, assets/js/*.js, and each file in assets/img and assets/qr
// has a row below with a byte ceiling about 10 percent over its size on 2026-10-10.
// A file with no row fails (a new file must be added on purpose). A row for a file that no longer exists fails.
// A file over its ceiling fails until its row is raised on purpose, with a reason.
// No network and no jsdom: this only reads file sizes on disk.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Which directories are watched. ext null means every file in the directory (one level, no subfolders).
const GROUPS = [
  { dir: "data", ext: ".json" },
  { dir: "assets/css", ext: ".css" },
  { dir: "assets/js", ext: ".js" },
  { dir: "assets/img", ext: null },
  { dir: "assets/qr", ext: null },
];

// Path (from the repo root) to { ceiling: bytes on disk, reason }.
// Ceilings are today's size on 2026-10-10 rounded up to 100 bytes, plus about 10 percent.
const TABLE = {
  // 2026-10-12: +77 Plains state cards (2,291 programs). Raised: entries-core 405100 to 414000 (413,887 bytes), entries-detail 1673600 to 1693000 (1,692,808), entries-lite 2131300 to 2173000 (2,172,802), entries-stats 667500 to 682000 (681,806), entries.json 4396300 to 4465000 (4,464,728).
  "data/calendar.json": { ceiling: 15700, reason: "data file, 14265 bytes measured 2026-10-10" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/employers.json ceiling 149800 to 172100.
  // 2026-10-13: four employer caveats (2,409 programs, 188 employers). data/employers.json limit 172100 to 172500.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/employers.json limit 172500 to 190100.
  "data/employers.json": { ceiling: 190100, reason: "data file, 136131 bytes measured 2026-10-10" },
  "data/entries-cal.json": { ceiling: 72600, reason: "data file, 65976 bytes measured 2026-10-10" },
  // 2026-10-13: +7 Plains and North Dakota cards (2,298 programs). Raised: entries-core 414000 to 415500, entries-detail 1693000 to 1698000, entries-lite 2173000 to 2180000, entries-stats 682000 to 684000, entries.json 4465000 to 4478000.
  // 2026-10-13: +50 city cards for the six new Where cities (2,348 programs). Raised to measured sizes rounded up: core 424100, detail 1731000, lite 2223100, stats 697700, entries.json 4567200.
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json ceiling 424100 to 435000.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json limit 435000 to 447500.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json limit 447500 to 454800.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-core.json limit 454800 to 470500.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-core.json limit 470500 to 470800.
  "data/entries-core.json": { ceiling: 470800, reason: "data file, 368201 bytes measured 2026-10-10" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-detail.json ceiling 1731000 to 1772700.
  // 2026-10-13: four repointed links after the link check. data/entries-detail.json limit 1772700 to 1772900.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-detail.json limit 1772900 to 1823500.
  // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries-detail.json limit 1823500 to 1824500.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-detail.json limit 1824500 to 1851500.
  // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries-detail.json limit 1851500 to 1853200.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-detail.json limit 1853200 to 1921000.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-detail.json limit 1921000 to 1922700.
  "data/entries-detail.json": { ceiling: 1922700, reason: "data file, 1521373 bytes measured 2026-10-10" },
  "data/entries-home.json": { ceiling: 899400, reason: "data file, 817599 bytes measured 2026-10-10" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json ceiling 2223100 to 2277600.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json limit 2277600 to 2341900.
  // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries-lite.json limit 2341900 to 2342200.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json limit 2342200 to 2377900.
  // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries-lite.json limit 2377900 to 2378800.
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you data/entries-lite.json limit 2378800 to 2383200.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-lite.json limit 2383200 to 2467100.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-lite.json limit 2467100 to 2468900.
  "data/entries-lite.json": { ceiling: 2468900, reason: "data file, 1937500 bytes measured 2026-10-10" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-stats.json ceiling 697700 to 716100.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-stats.json limit 716100 to 736500.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-stats.json limit 736500 to 748900.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-stats.json limit 748900 to 776000.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-stats.json limit 776000 to 776700.
  "data/entries-stats.json": { ceiling: 776700, reason: "data file, 606782 bytes measured 2026-10-10" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries.json ceiling 4567200 to 4677300.
  // 2026-10-13: four repointed links after the link check. data/entries.json limit 4677300 to 4677700.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries.json limit 4677700 to 4809900.
  // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries.json limit 4809900 to 4811300.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries.json limit 4811300 to 4883300.
  // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries.json limit 4883300 to 4885900.
  // 2026-10-14 persona round 9: built cards carry a derived limited flag (325 cards) for Good fit and the Only some can apply tag data/entries.json limit 4885900 to 4891200.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries.json limit 4891200 to 5066300.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries.json limit 5066300 to 5070300.
  "data/entries.json": { ceiling: 5070300, reason: "data file, 3996617 bytes measured 2026-10-10" },
  "data/expiring-dates.json": { ceiling: 1700, reason: "data file, 1530 bytes measured 2026-10-10" },
  "data/gaps.json": { ceiling: 5400, reason: "data file, 4832 bytes measured 2026-10-10" },
  "data/interview.json": { ceiling: 12400, reason: "data file, 11207 bytes measured 2026-10-10" },
  "data/languages.json": { ceiling: 9200, reason: "data file, 8310 bytes measured 2026-10-10" },
  "data/meta.json": { ceiling: 200, reason: "data file, 115 bytes measured 2026-10-10" },
  "data/money.json": { ceiling: 14000, reason: "data file, 12691 bytes measured 2026-10-10" },
  "data/parents.json": { ceiling: 29000, reason: "data file, 26357 bytes measured 2026-10-10" },
  "data/permits.json": { ceiling: 90700, reason: "data file, 82370 bytes measured 2026-10-10" },
  "data/safety.json": { ceiling: 46800, reason: "data file, 42538 bytes measured 2026-10-10" },
  "data/state-wages.json": { ceiling: 25700, reason: "data file, 23349 bytes measured 2026-10-10" },
  "data/states-lite.json": { ceiling: 48000, reason: "data file, 43610 bytes measured 2026-10-10" },
  "data/transit.json": { ceiling: 9100, reason: "data file, 8193 bytes measured 2026-10-10" },
  "data/younger.json": { ceiling: 19600, reason: "data file, 17796 bytes measured 2026-10-10" },
  // 2026-10-13: ticket ux9-pills. style.css 48800 to 48900 (.fpill round pill rule; 48834 bytes).
  // 2026-10-14: persona round 9. common.js 34700 to 34900 (typed towns such as Fremont find their Where choice; 34859 bytes), find.js 64500 to 66400 (Good fit keeps the QR area, Only some can apply tag, fuller Copy my list text, picks keep the pay choice; 66476 bytes).
  // 2026-10-13: ticket ux9-place-search-option. common.js 34500 to 34700 (empty caption and any-label options on the shared place box; 34554 bytes).
  // 2026-10-12: Programs filters redesign. style.css 46100 to 48300 (summary bar, pill rows, phone bar; 48237 bytes), common.js 28300 to 34500 (the shared place search box; 34453 bytes), find.js 59300 to 64500 (summary bar and phone bar code; 64477 bytes). home.js got smaller, so its row stays.
  "assets/css/fonts.css": { ceiling: 6800, reason: "stylesheet, 6158 bytes measured 2026-10-10" },
  // 2026-10-13: ticket ux9-page-top. style.css 48900 to 49000 (.notes and .topnote rule; 48937 bytes).
  // 2026-10-13: ticket ux9-header-footer. style.css 49000 to 49800 (phone header, Menu grid, footer columns; 49757 bytes).
  // 2026-10-13: ticket ux9-quiet-cards. style.css 49800 to 50100 (quiet card h3, a.chip, .g2x2; 50049 bytes).
  // 2026-10-13: ticket ux9-header-footer (320 px overflow fixes). style.css 50100 to 50300 (50259 bytes).
  // 2026-10-13: ux9 review fixes (.tablewrap position, Jobs hours gap). style.css 50300 to 50400 (50324 bytes).
  // 2026-10-13: ux9 review fixes. style.css 50400 to 50500 (50427 bytes).
  // 2026-10-13: workshop leaders round. style.css 50500 to 50600 (50571 bytes).
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. assets/css/style.css limit 50700 to 51200.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). assets/css/style.css limit 51200 to 52100.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). assets/css/style.css limit 52100 to 52300.
  // 2026-10-14: phone tables drop the 34rem floor; rules hours table stacks (PENDING PERSON APPROVAL). assets/css/style.css limit 52300 to 52400.
  // 2026-10-15: phone header folds before scripts, tables stack, clockLabel (PENDING PERSON APPROVAL). assets/css/style.css limit 52400 to 52600.
  "assets/css/style.css": { ceiling: 52600, reason: "stylesheet, 41831 bytes measured 2026-10-10; 50638 bytes on 2026-10-14 after the phone filter summary fix" },
  "assets/js/calendar.js": { ceiling: 8800, reason: "script, 7966 bytes measured 2026-10-10" },
  "assets/js/common.js": { ceiling: 34900, reason: "script, 25681 bytes measured 2026-10-10" },
  // Raised from 58100 to 59300 on 2026-10-12 for ticket diet-1 (Where group files on the Programs page). 59217 bytes measured.
  "assets/js/find.js": { ceiling: 66600, reason: "script, 52771 bytes measured 2026-10-10" },
  "assets/js/handout.js": { ceiling: 600, reason: "script, 274 bytes measured 2026-10-10; 517 bytes on 2026-10-14 with the one page handout and table plan print buttons" },
  // 2026-10-12: home picker flow. home.js grew by about 8.8 KB (place search box, chip, step markers); ceiling raised from 10800 to 18600, measured 18585 bytes.
  "assets/js/home.js": { ceiling: 18700, reason: "script, 18605 bytes measured 2026-10-12 (home picker flow, plus the 1 day label)" },
  "assets/js/insights.js": { ceiling: 6100, reason: "script, 5471 bytes measured 2026-10-10" },
  "assets/js/interview.js": { ceiling: 20400, reason: "script, 18422 bytes measured 2026-10-10" },
  "assets/js/jobs.js": { ceiling: 24400, reason: "script, 22099 bytes measured 2026-10-10" },
  "assets/js/languages.js": { ceiling: 4000, reason: "script, 3579 bytes measured 2026-10-10" },
  "assets/js/leaders.js": { ceiling: 8100, reason: "script, 7361 bytes measured 2026-10-10" },
  "assets/js/lib.js": { ceiling: 55300, reason: "script, 50207 bytes measured 2026-10-10" },
  // 2026-10-14: parents permit table stacks on phones (ARIA roles and column labels) parents.js 3900 to 4200. PENDING PERSON APPROVAL.
  // 2026-10-14: parents opens on ?state= or the saved Programs place and keeps state= in the address parents.js 4200 to 5500. PENDING PERSON APPROVAL.
  "assets/js/parents.js": { ceiling: 5500, reason: "script, 3529 bytes measured 2026-10-10" },
  // Raised for ticket p8-paycheck-other: the Another state picker and its wage and federal tax lines. 12055 bytes measured 2026-10-12.
  // Raised again for the live status line on Another state (a state pick, and the failed wage load). 12208 bytes measured 2026-10-12.
  "assets/js/paycheck.js": { ceiling: 12500, reason: "raised 2026-10-13 for ticket ux9-other-state-search (place box); script, 12208 bytes measured 2026-10-12 (Another state picker and its live status line, p8-paycheck-other)" },
  // Raised for ticket p8-permit-lite-print: the printable checklist and next step on the shorter state answers. 31519 bytes measured 2026-10-12.
  "assets/js/permit.js": { ceiling: 31950, reason: "script, 31830 bytes measured 2026-10-13 (ux9-permit-flow: state search box on the shorter-state list; was 31519 on 2026-10-12, p8-permit-lite-print)" },
  "assets/js/playbook.js": { ceiling: 19200, reason: "script, 17385 bytes measured 2026-10-10" },
  "assets/js/ready.js": { ceiling: 12400, reason: "script, 10954 bytes measured 2026-10-10; 12374 bytes on 2026-10-14 with Santa Ana Unified and Newport-Mesa Unified permit steps" },
  "assets/js/resume.js": { ceiling: 9600, reason: "script, 8687 bytes measured 2026-10-10" },
  "assets/js/safety.js": { ceiling: 9700, reason: "script, 8781 bytes measured 2026-10-10" },
  "assets/js/share.js": { ceiling: 1900, reason: "script, 1681 bytes measured 2026-10-10" },
  "assets/js/states.js": { ceiling: 2600, reason: "script, 2290 bytes measured 2026-10-10" },
  // Raised for ticket p9-younger-1: the permit-only states in the picker and their permit card. 16622 bytes measured 2026-10-12.
  // 2026-10-14: younger.html carries the picked state into Programs links, counts and the not-stated note (persona r9) younger.js 17900 to 20200, then 20300 (the plain buttons keep the state when the count file fails), then 20900 (the grid stacks on phones: roles and state labels). PENDING PERSON APPROVAL.
  "assets/js/younger.js": { ceiling: 20900, reason: "raised 2026-10-13 for ticket ux9-other-state-search (place box); script, 17599 bytes measured 2026-10-12 (permit-only states and card, p9-younger-1; plain note when the grid does not cover the state, p8-younger-state)" },
  "assets/img/favicon.svg": { ceiling: 500, reason: "image, 409 bytes measured 2026-10-10" },
  "assets/img/og.jpg": { ceiling: 90200, reason: "image, 81997 bytes measured 2026-10-10" },
  "assets/img/splat-orange.svg": { ceiling: 5500, reason: "image, 4991 bytes measured 2026-10-10" },
  "assets/img/splat-yellow.svg": { ceiling: 5600, reason: "image, 5086 bytes measured 2026-10-10" },
  "assets/img/swoosh.svg": { ceiling: 500, reason: "image, 449 bytes measured 2026-10-10" },
  "assets/qr/atlanta.svg": { ceiling: 2400, reason: "QR image, 2135 bytes measured 2026-10-10" },
  "assets/qr/chicago.svg": { ceiling: 2400, reason: "QR image, 2116 bytes measured 2026-10-10" },
  "assets/qr/home.svg": { ceiling: 2000, reason: "QR image, 1728 bytes measured 2026-10-10" },
  "assets/qr/interview.svg": { ceiling: 2500, reason: "QR image, 2214 bytes measured 2026-10-10" },
  "assets/qr/new-york.svg": { ceiling: 2300, reason: "QR image, 2068 bytes measured 2026-10-10" },
  "assets/qr/norcal.svg": { ceiling: 2300, reason: "QR image, 2086 bytes measured 2026-10-10" },
  "assets/qr/parents.svg": { ceiling: 2400, reason: "QR image, 2121 bytes measured 2026-10-10" },
  "assets/qr/permit.svg": { ceiling: 2400, reason: "QR image, 2118 bytes measured 2026-10-10" },
  "assets/qr/socal.svg": { ceiling: 2400, reason: "QR image, 2115 bytes measured 2026-10-10" },
  "assets/qr/younger.svg": { ceiling: 2400, reason: "QR image, 2126 bytes measured 2026-10-10" },
};

// Every file the ratchet watches, as repo-relative paths with forward slashes.
function watchedFiles() {
  const found = [];
  for (const group of GROUPS) {
    const dir = path.join(ROOT, group.dir);
    for (const name of fs.readdirSync(dir).sort()) {
      if (group.ext && path.extname(name) !== group.ext) continue;
      if (!fs.statSync(path.join(dir, name)).isFile()) continue;
      found.push(`${group.dir}/${name}`);
    }
  }
  return found;
}

test("every watched file has a ratchet row", () => {
  const missing = watchedFiles().filter((file) => !Object.hasOwn(TABLE, file));
  assert.equal(
    missing.length,
    0,
    `no ratchet row for: ${missing.join(", ")}. Add a row on purpose, with a ceiling and a reason.`,
  );
});

test("no ratchet row points at a file that no longer exists", () => {
  const stale = Object.keys(TABLE).filter((file) => !fs.existsSync(path.join(ROOT, file)));
  assert.equal(
    stale.length,
    0,
    `ratchet rows for files that are gone: ${stale.join(", ")}. Remove the row or restore the file.`,
  );
});

test("every watched file is under its byte ceiling", () => {
  const over = [];
  for (const file of Object.keys(TABLE)) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const size = fs.statSync(full).size;
    if (size > TABLE[file].ceiling) {
      over.push(`${file}: ${size} bytes, ceiling ${TABLE[file].ceiling} bytes`);
    }
  }
  assert.equal(over.length, 0, `over the size ceiling: ${over.join("; ")}`);
});
