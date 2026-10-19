// First-load code weight per built root page. A page's total is the byte size on disk of every
// <script src> and <link rel="stylesheet"> it names. Each page has a ceiling about 5% over today's size.
// Going over a ceiling fails the test: add the weight on purpose and raise the row, with a reason.
// Also checks that lib.js loads only where a script uses it, and that no script tag points at an external http(s) URL.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Raised on 2026-10-12 after the r1 round: the stylesheet grew by about 300 bytes (forced colors nav rule, silent summary marks, QR image look) and find.js by about 500 bytes (More filters count); each page that went over has its ceiling set to the measured size rounded up plus 100.
// Raised on 2026-10-12 after the r2 round (new-tab observer scope, hover media, referrer policy and the common.js and stylesheet changes every page carries): each page that went over has its ceiling set to the measured size rounded up plus 100.
// Raised on 2026-10-12 after merging persona round 5 (shorter state card wording, federal floor line, wage notes, new cities): nine pages by 100 to 400 bytes each, ceiling set to the measured size rounded up plus 100.
// Raised on 2026-10-12 for ticket r3-a11y-perf-2: the #printRoot link address print rule in style.css (about 330 bytes on every page); each page that went over has its ceiling set to the measured size rounded up plus 100.
// Raised 2026-10-12 for round 8 tickets p8-paycheck-other (paycheck.js), p8-permit-lite-print (permit.js) and p8-younger-state (younger.js): paycheck, permit and younger went over; each ceiling is the measured size rounded up plus 100.
// Raised 2026-10-12 round 6 merge: the pages listed grew a few hundred bytes (younger.js lite states, lib.js new regions); each ceiling is the measured size rounded up plus 100.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB_NAMES = /\b(?:G|TIG)\.(?:esc|safeUrl|parseISO|fmtDate|daysUntil|lib|fillPlaces|placeTiles|REGIONS|HUBS|TYPES|FIELDS|PAID)\b/;
const PICKER_CALLS = /\b(?:G|TIG)\.(?:tilePicker|autoTiles)\b/;

// Ceilings: bytes on disk for each page's script and stylesheet files, about 5% over today's total (rounded up to 100 bytes).
// Raised on 2026-10-12 for ticket r3-a11y-perf-35: the body min-height 100dvh line in style.css adds 22 bytes, so every page that loads style.css has its ceiling raised by 22 bytes and nothing else.
const BUDGET = {
  // 2026-10-18: main merged in after PR 36 (persona r11, map, sweep, wages, screen reader) into add to calendar (PENDING PERSON APPROVAL, merging approves): pages over set to the measured size rounded up to 100.
  // 2026-10-18: main merged in after PR 37 (street map, quality sweep, wages, screen reader names) into persona r11 (PENDING PERSON APPROVAL, merging approves): pages over set to the measured size rounded up to 100.
  // 2026-10-16 persona r11 review fixes (picks hold back grade-flagged cards): pages over set to the measured size rounded up to 100.
  // 2026-10-16 persona r11 rebased on the map merge (grade flag in find.js and lib.js, younger unknown cells carry the number, trust line on five landing pages): pages over set to the measured size rounded up to 100.
  // 2026-10-15 Map page rebased on main (brand wrap CSS plus map rules): pages over set to the measured size rounded up to 100.
  // 2026-10-15 Map page rebased on main again (narrow phone CSS plus map rules): pages over set to the measured size rounded up to 100.
  // 2026-10-15: new Map page (map.html): lib.js, common.js and map.js; set after the rebase by the ceiling tool.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). map.html limit 198300 to 200100 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "map.html": { ceiling: 200100, reason: "lib.js, common.js and map.js" },
  // 2026-10-16: the Map page street map (map.js hand-off and style.css rules for the street map box) (PENDING PERSON APPROVAL): pages over set to the measured size rounded up to 100.
  // 2026-10-18: main merged in after PR 54 (common.js grew for the screen reader names), paycheck.html 165300 to 165400 (PENDING PERSON APPROVAL, merging approves): pages over set to the measured size rounded up to 100.
  // 2026-10-15 state places cover every region in the state, Elgin label: pages over set to the measured size rounded up to 100.
  // 2026-10-15 persona round 10 content: pages over set to the measured size rounded up to 100.
  // 2026-10-14 jobs.js shows a state's own hours rule for 12 and 13 (California) and links the Bay Area ride table: jobs.html set to the measured size rounded up to 100.
  // 2026-10-14 tap-to-call numbers in the ages 12 to 14 grid (younger.js): younger.html set to the measured size rounded up to 100.
  // 2026-10-14 SoCal round 10: the filter summary min-width and wrapping place pill (style.css, every page) and the Santa Ana and Newport-Mesa district steps (ready.js). Pages over set to the measured size rounded up to 100.
  // 2026-10-14 persona round 9 UI: find.js gains the Only some can apply tag and the fuller Copy my list text, handout.js the table plan print button. Pages over set to the measured size rounded up to 100.
  // 2026-10-14 event fixes: the paycheck table fits a phone (about 15 bytes in style.css) and the handout gets a one page print button (handout.js). Pages over set to the measured size rounded up to 100.
  // 2026-10-13 workshop leaders round merged with the look and feel round: pages over set to the measured size rounded up to 100.
  // Raised on 2026-10-13 for ticket p9-cities-plains: lib.js grew by about 370 bytes (El Paso, Omaha, Wichita, Des Moines, Billings and Boise Where choices). Each page that loads lib.js and went over has its ceiling set to the measured size rounded up to 100.
  // 2026-10-12: Programs filters redesign. The shared place search box moved into common.js (about 8 KB, every page loads it; Home's own copy came out of home.js) and style.css gained the summary bar, pill rows and phone bar rules (about 3.6 KB); find.js gained the summary bar and phone bar code (about 5 KB). Every page went over, and each ceiling is the measured size rounded up to the next 100.
  // 2026-10-12: home picker flow. style.css grew by about 2.3 KB (the numbered steps, the place search box and its list, the chip) and home.js by about 8 KB (the search box, chip and step markers). Every page that loads style.css and went over has its ceiling set to the measured size rounded up to the next 100; index.html also carries the new home.js.
// Raised on 2026-10-12 for tickets r3-tests-1 and r3-a11y-perf-5: the leading-symbol trim in lib.js (all pages that load it) and the phone Search key in find.js and home.js; find.html and index.html are the pages that went over, ceiling set to the measured size rounded up plus 100.
  // Raised on 2026-10-12 for ticket p9-regions-1: lib.js grew by 886 bytes (8 Plains and Mountain states in REGIONS, HUBS, STATES, PICK_GROUPS and STATE_OF). Every page that loads lib.js and went over has its ceiling set to the measured size rounded up plus 100 (other tickets in the same tree added bytes too).
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you 404.html limit 91300 to 91700.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. 404.html limit 91700 to 92200.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). 404.html limit 92200 to 93200.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). 404.html limit 93200 to 93300.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). 404.html limit 93300 to 93600.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). 404.html limit 93600 to 94400.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). 404.html limit 94400 to 95000.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). 404.html limit 95000 to 95300.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). 404.html limit 95300 to 95500.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). 404.html limit 95500 to 95800.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). 404.html limit 96200 to 97000.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). 404.html limit 97000 to 97400.
  "404.html": { ceiling: 101100, reason: "common.js and both stylesheets only; no page script" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you about.html limit 91300 to 91700.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. about.html limit 91700 to 92200.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). about.html limit 92200 to 93200.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). about.html limit 93200 to 93300.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). about.html limit 93300 to 93600.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). about.html limit 93600 to 94400.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). about.html limit 94400 to 95000.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). about.html limit 95000 to 95300.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). about.html limit 95300 to 95500.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). about.html limit 95500 to 95800.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). about.html limit 96200 to 97000.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). about.html limit 97000 to 97400.
  "about.html": { ceiling: 101100, reason: "common.js and both stylesheets only; no page script" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you calendar.html limit 151000 to 152100.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. calendar.html limit 152100 to 152600.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). calendar.html limit 152600 to 153600.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). calendar.html limit 153600 to 153700.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). calendar.html limit 153700 to 154600.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). calendar.html limit 154600 to 155400.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). calendar.html limit 155400 to 156000.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). calendar.html limit 156000 to 156400.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). calendar.html limit 156400 to 156600.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). calendar.html limit 156600 to 156900.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). calendar.html limit 157600 to 158300.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). calendar.html limit 158300 to 158400.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). calendar.html limit 158400 to 158700.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). calendar.html limit 165100 to 167500 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "calendar.html": { ceiling: 167500, reason: "lib.js, common.js and calendar.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you contribute.html limit 91300 to 91700.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. contribute.html limit 91700 to 92200.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). contribute.html limit 92200 to 93200.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). contribute.html limit 93200 to 93300.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). contribute.html limit 93300 to 93600.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). contribute.html limit 93600 to 94400.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). contribute.html limit 94400 to 95000.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). contribute.html limit 95000 to 95300.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). contribute.html limit 95300 to 95500.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). contribute.html limit 95500 to 95800.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). contribute.html limit 96200 to 97000.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). contribute.html limit 97000 to 97400.
  "contribute.html": { ceiling: 101100, reason: "common.js and both stylesheets only; no page script" },
  // Raised on 2026-10-11 for ticket p7-regions-1: lib.js grew by 1,296 bytes (11 new states in REGIONS, HUBS, STATES, PICK_GROUPS and STATE_OF). find.html loads 171395 bytes of code, ceiling raised from 170500 to 171400.
  // Raised 2026-10-11 after the new-states merge (regions and places in lib.js, wages reader in common.js): find 171400 to 171500, jobs 141100 to 141900, permit 145000 to 145400.
  // Raised from 171500 to 172800 on 2026-10-11 for tickets p8-lite-1 and p8-cities-1: big cities of the 11 new states in lib.js, plain missing-fact answers and wage notes in common.js and permit.js.
  // Raised from 179400 to 185200 on 2026-10-12 for ticket diet-1: find.js grew by about 6 KB (ten literal chunk URLs for the lite files and ten for the detail files, the place to chunk mapping, and the fallback to the whole file). find.html loads 185192 bytes of code.
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you find.html limit 207400 to 209800.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. find.html limit 210500 to 211000.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). find.html limit 211000 to 211900.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). find.html limit 211900 to 212100.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). find.html limit 212100 to 213000.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). find.html limit 213000 to 213800.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). find.html limit 213800 to 214400.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). find.html limit 214400 to 214800.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). find.html limit 214800 to 215000.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). find.html limit 215000 to 215200.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). find.html limit 215800 to 216500.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). find.html limit 216500 to 216600.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). find.html limit 216600 to 216900.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). find.html limit 224800 to 226300 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "find.html": { ceiling: 226300, reason: "lib.js, common.js and find.js (largest page script)" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you handout.html limit 91700 to 92100.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. handout.html limit 92200 to 92700.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). handout.html limit 92700 to 93700.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). handout.html limit 93700 to 93800.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). handout.html limit 93800 to 94100.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). handout.html limit 94100 to 94900.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). handout.html limit 94900 to 95500.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). handout.html limit 95500 to 95900.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). handout.html limit 95900 to 96100.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). handout.html limit 96100 to 96300.
  // 2026-10-15: lint fixes (PENDING PERSON APPROVAL). handout.html limit 96300 to 96400.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). handout.html limit 96700 to 97500.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). handout.html limit 97500 to 97900.
  "handout.html": { ceiling: 101600, reason: "common.js, handout.js and both stylesheets; no lib.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you index.html limit 155000 to 156100.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. index.html limit 156100 to 156600.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). index.html limit 156600 to 157600.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). index.html limit 157600 to 157700.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). index.html limit 157700 to 158600.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). index.html limit 158600 to 159400.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). index.html limit 159400 to 160000.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). index.html limit 160000 to 160400.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). index.html limit 160400 to 160600.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). index.html limit 160600 to 160900.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). index.html limit 161600 to 162300.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). index.html limit 162300 to 162400.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). index.html limit 162400 to 162700.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). index.html limit 169000 to 170800 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "index.html": { ceiling: 170800, reason: "lib.js, common.js and home.js (2026-10-12: +100 for the 1 day label and phone heading size)" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you insights.html limit 148400 to 149400.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. insights.html limit 149500 to 150200.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). insights.html limit 150200 to 151200.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). insights.html limit 151200 to 151300.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). insights.html limit 151300 to 152200.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). insights.html limit 152200 to 153000.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). insights.html limit 153000 to 153600.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). insights.html limit 153600 to 154000.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). insights.html limit 154000 to 154200.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). insights.html limit 154200 to 154500.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). insights.html limit 155200 to 155900.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). insights.html limit 155900 to 156000.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). insights.html limit 156000 to 156300.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). insights.html limit 162600 to 164500 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "insights.html": { ceiling: 164500, reason: "lib.js, common.js and insights.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you interview.html limit 161300 to 162400.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. interview.html limit 162500 to 163000.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). interview.html limit 163000 to 163900.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). interview.html limit 163900 to 164000.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). interview.html limit 164000 to 165000.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). interview.html limit 165000 to 165800.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). interview.html limit 165800 to 166400.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). interview.html limit 166400 to 166800.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). interview.html limit 166800 to 166900.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). interview.html limit 166900 to 167200.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). interview.html limit 167900 to 168700.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). interview.html limit 168700 to 169000.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). interview.html limit 175400 to 177200 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "interview.html": { ceiling: 177200, reason: "lib.js, common.js and interview.js" },
  // Raised on 2026-10-11 for ticket p7-regions-1: lib.js grew by 1,296 bytes (11 new states in REGIONS, HUBS, STATES, PICK_GROUPS and STATE_OF). jobs.html loads 141025 bytes (the rest of the growth came from other work in common.js and jobs.js), ceiling raised from 138200 to 141100.
  // Raised from 141900 to 143500 on 2026-10-11 for tickets p8-lite-1 and p8-cities-1: big cities of the 11 new states in lib.js, plain missing-fact answers and wage notes in common.js and permit.js.
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you jobs.html limit 165200 to 166300.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. jobs.html limit 166400 to 166900.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). jobs.html limit 166900 to 167800.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). jobs.html limit 167800 to 167900.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). jobs.html limit 168900 to 169800.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). jobs.html limit 169800 to 170600.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). jobs.html limit 170600 to 171200.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). jobs.html limit 171200 to 171600.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). jobs.html limit 171600 to 171800.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). jobs.html limit 171800 to 172100.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). jobs.html limit 172800 to 173500.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). jobs.html limit 173500 to 173600.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). jobs.html limit 173600 to 173900.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). jobs.html limit 180200 to 182100 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "jobs.html": { ceiling: 182100, reason: "lib.js, common.js and jobs.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you languages.html limit 146500 to 147600.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. languages.html limit 147600 to 148100.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). languages.html limit 148100 to 149000.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). languages.html limit 149000 to 149200.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). languages.html limit 149200 to 150100.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). languages.html limit 150100 to 150900.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). languages.html limit 150900 to 151500.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). languages.html limit 151500 to 151900.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). languages.html limit 151900 to 152100.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). languages.html limit 152100 to 152300.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). languages.html limit 153100 to 153800.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). languages.html limit 153800 to 154200.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). languages.html limit 160500 to 162300 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "languages.html": { ceiling: 162300, reason: "lib.js, common.js and languages.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you leaders.html limit 98700 to 99000.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. leaders.html limit 99100 to 99600.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). leaders.html limit 99600 to 100500.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). leaders.html limit 100500 to 100600.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). leaders.html limit 100600 to 100900.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). leaders.html limit 100900 to 101700.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). leaders.html limit 101700 to 102300.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). leaders.html limit 102300 to 102700.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). leaders.html limit 102700 to 102900.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). leaders.html limit 102900 to 103200.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). leaders.html limit 103600 to 104300.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). leaders.html limit 104300 to 104400.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). leaders.html limit 104400 to 104700.
  "leaders.html": { ceiling: 108400, reason: "common.js, leaders.js and both stylesheets; no lib.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you parents.html limit 146400 to 147500.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. parents.html limit 147500 to 148000.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). parents.html limit 148000 to 149600.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). parents.html limit 149600 to 149700.
  // 2026-10-14: parents page opens on the family's state (PENDING PERSON APPROVAL). parents.html limit 149700 to 151000.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). parents.html limit 151000 to 152000.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). parents.html limit 152000 to 152700.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). parents.html limit 152700 to 153400.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). parents.html limit 153400 to 153700.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). parents.html limit 153700 to 153900.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). parents.html limit 153900 to 154200.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). parents.html limit 155000 to 155700.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). parents.html limit 155700 to 156100.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). parents.html limit 162400 to 164200 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "parents.html": { ceiling: 164200, reason: "lib.js, common.js and parents.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you paycheck.html limit 155300 to 156400.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. paycheck.html limit 156400 to 156900.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). paycheck.html limit 156900 to 157900.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). paycheck.html limit 157900 to 158000.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). paycheck.html limit 158000 to 158900.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). paycheck.html limit 158900 to 159700.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). paycheck.html limit 159700 to 160300.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). paycheck.html limit 160300 to 160700.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). paycheck.html limit 160700 to 160900.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). paycheck.html limit 160900 to 161200.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). paycheck.html limit 161900 to 162600.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). paycheck.html limit 162600 to 162700.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). paycheck.html limit 162700 to 163000.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). paycheck.html limit 169300 to 171200 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "paycheck.html": { ceiling: 171200, reason: "lib.js, common.js and paycheck.js" },
  // Raised from 139900 to 141000 on 2026-10-11 when the third upgrade round was merged: permit.js grew by 716 bytes and the page is 140932 bytes.
  // Raised from 141000 to 142300 on 2026-10-11 for ticket p6-permit-1: the age line on the shorter state answer (about 1,300 bytes in permit.js) and the shared G.stateShorts() reader in common.js (about 300 bytes, which jobs.js and younger.js now share instead of each fetching the file). The page is 142229 bytes.
  // Raised from 142300 to 142500 on 2026-10-11 after the persona round 4 merge: permit.html loads 142397 bytes of code (a 97 byte overage that came from combining the two lines of work).
  // Raised on 2026-10-11 for ticket p7-regions-1: lib.js grew by 1,296 bytes (11 new states in REGIONS, HUBS, STATES, PICK_GROUPS and STATE_OF). permit.html loads 144940 bytes (the rest of the growth came from other work in common.js and permit.js), ceiling raised from 142500 to 145000.
  // Raised from 145400 to 148600 on 2026-10-11 for tickets p8-lite-1 and p8-cities-1: big cities of the 11 new states in lib.js, plain missing-fact answers and wage notes in common.js and permit.js.
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you permit.html limit 174700 to 175900.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. permit.html limit 176000 to 176500.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). permit.html limit 176500 to 177400.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). permit.html limit 177400 to 177500.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). permit.html limit 177500 to 178500.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). permit.html limit 178500 to 179200.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). permit.html limit 179200 to 179900.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). permit.html limit 179900 to 180200.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). permit.html limit 180200 to 180400.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). permit.html limit 180400 to 180700.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). permit.html limit 181300 to 182000.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). permit.html limit 182000 to 182100.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). permit.html limit 182100 to 182400.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). permit.html limit 188700 to 190500 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "permit.html": { ceiling: 190500, reason: "lib.js, common.js and permit.js" },
  // Raised on 2026-10-12 for tickets p9-regions-1 and p9-playbook-1: lib.js grew (Plains states) and style.css gained two small rules. jobs, playbook, resume, states and younger ceilings each raised by 100.
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you playbook.html limit 160300 to 161400.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. playbook.html limit 161400 to 161900.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). playbook.html limit 161900 to 162900.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). playbook.html limit 162900 to 163000.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). playbook.html limit 163000 to 163900.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). playbook.html limit 163900 to 164700.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). playbook.html limit 164700 to 165300.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). playbook.html limit 165300 to 165700.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). playbook.html limit 165700 to 165900.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). playbook.html limit 165900 to 166100.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). playbook.html limit 166900 to 167600.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). playbook.html limit 167600 to 167700.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). playbook.html limit 167700 to 168000.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). playbook.html limit 174300 to 176100 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "playbook.html": { ceiling: 176100, reason: "lib.js, common.js and playbook.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you ready.html limit 153800 to 154900.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. ready.html limit 156400 to 156900.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). ready.html limit 156900 to 157800.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). ready.html limit 157800 to 158000.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). ready.html limit 158000 to 158900.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). ready.html limit 158900 to 159700.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). ready.html limit 159700 to 160300.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). ready.html limit 160300 to 160700.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). ready.html limit 160700 to 160900.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). ready.html limit 160900 to 161100.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). ready.html limit 161900 to 162600.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). ready.html limit 162600 to 163000.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). ready.html limit 169300 to 171100 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "ready.html": { ceiling: 171100, reason: "lib.js, common.js and ready.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you resume.html limit 151600 to 152700.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. resume.html limit 152700 to 153200.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). resume.html limit 153200 to 154200.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). resume.html limit 154200 to 154300.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). resume.html limit 154300 to 155200.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). resume.html limit 155200 to 156000.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). resume.html limit 156000 to 156600.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). resume.html limit 156600 to 157000.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). resume.html limit 157000 to 157200.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). resume.html limit 157200 to 157500.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). resume.html limit 158200 to 158900.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). resume.html limit 158900 to 159000.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). resume.html limit 159000 to 159300.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). resume.html limit 165600 to 167400 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "resume.html": { ceiling: 167400, reason: "lib.js, common.js and resume.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you rules.html limit 91300 to 91700.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. rules.html limit 91700 to 92200.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). rules.html limit 92200 to 93200.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). rules.html limit 93200 to 93300.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). rules.html limit 93300 to 93600.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). rules.html limit 93600 to 94400.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). rules.html limit 94400 to 95000.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). rules.html limit 95000 to 95300.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). rules.html limit 95300 to 95500.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). rules.html limit 95500 to 95800.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). rules.html limit 96200 to 97000.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). rules.html limit 97000 to 97400.
  "rules.html": { ceiling: 101100, reason: "common.js and both stylesheets only; no page script" },
  // Raised on 2026-10-11 for ticket p7-regions-1: lib.js grew by 1,296 bytes (11 new states in REGIONS, HUBS, STATES, PICK_GROUPS and STATE_OF). safety.html loads 128805 bytes, ceiling raised from 127600 to 128900.
  // Raised from 128900 to 130200 on 2026-10-11 for tickets p8-lite-1 and p8-cities-1: big cities of the 11 new states in lib.js, plain missing-fact answers and wage notes in common.js and permit.js.
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you safety.html limit 151700 to 152800.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. safety.html limit 152800 to 153300.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). safety.html limit 153300 to 154300.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). safety.html limit 154300 to 154400.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). safety.html limit 154400 to 155300.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). safety.html limit 155300 to 156100.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). safety.html limit 156100 to 156700.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). safety.html limit 156700 to 157100.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). safety.html limit 157100 to 157300.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). safety.html limit 157300 to 157500.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). safety.html limit 158300 to 159000.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). safety.html limit 159000 to 159400.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). safety.html limit 165700 to 167500 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "safety.html": { ceiling: 167500, reason: "lib.js, common.js and safety.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you share.html limit 93000 to 93300.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. share.html limit 93400 to 93900.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). share.html limit 93900 to 94800.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). share.html limit 94800 to 94900.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). share.html limit 94900 to 95300.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). share.html limit 95300 to 96000.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). share.html limit 96000 to 96700.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). share.html limit 96700 to 97000.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). share.html limit 97000 to 97200.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). share.html limit 97200 to 97500.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). share.html limit 97900 to 98600.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). share.html limit 98600 to 98700.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). share.html limit 98700 to 99000.
  "share.html": { ceiling: 102700, reason: "common.js, share.js and both stylesheets; no lib.js" },
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you states.html limit 145400 to 146500.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. states.html limit 146600 to 147100.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). states.html limit 147100 to 148000.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). states.html limit 148000 to 148100.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). states.html limit 148100 to 149100.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). states.html limit 149100 to 149800.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). states.html limit 149800 to 150500.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). states.html limit 150500 to 150800.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). states.html limit 150800 to 151000.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). states.html limit 151000 to 151300.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). states.html limit 152000 to 152800.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). states.html limit 152800 to 153200.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). states.html limit 159500 to 161300 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "states.html": { ceiling: 161300, reason: "lib.js, common.js and states.js" },
  // Raised on 2026-10-11 for ticket p7-regions-1: lib.js grew by 1,296 bytes (11 new states in REGIONS, HUBS, STATES, PICK_GROUPS and STATE_OF). younger.html loads 131827 bytes, ceiling raised from 130800 to 131900.
  // Raised from 131900 to 133200 on 2026-10-11 for tickets p8-lite-1 and p8-cities-1: big cities of the 11 new states in lib.js, plain missing-fact answers and wage notes in common.js and permit.js.
  // Raised for ticket p9-younger-1: younger.js grew by about 4.3 KB (the permit-only state picker names, the permit card and its helpers). younger.html measured 142116 bytes on 2026-10-12, ceiling set to 142200.
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you younger.html limit 160700 to 161800.
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts. younger.html limit 161900 to 162300.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL). younger.html limit 162400 to 163300.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL). younger.html limit 163300 to 163400.
  // 2026-10-14: younger.html carries the picked state into Programs links (PENDING PERSON APPROVAL). younger.html limit 163400 to 165700.
  // 2026-10-15: phone header folds before scripts, tables stack (PENDING PERSON APPROVAL). younger.html limit 165700 to 167300.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). younger.html limit 167300 to 168100.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). younger.html limit 168100 to 168700.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). younger.html limit 168700 to 169100.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). younger.html limit 169100 to 169300.
  // 2026-10-15: drop build-time tiles when data fails (PENDING PERSON APPROVAL). younger.html limit 169300 to 169600.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). younger.html limit 170300 to 171000.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). younger.html limit 171000 to 171100.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). younger.html limit 171100 to 171400.
  // 2026-10-16: Add to calendar on deadlines, issue #10 (lib.js: reminders, Google Calendar link, which cards get it; about 1.9 KB) (PENDING PERSON APPROVAL). younger.html limit 178000 to 179900 (remeasured 2026-10-19 after main merged in with PRs 42 and 36).
  "younger.html": { ceiling: 179900, reason: "lib.js, common.js and younger.js" },
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
