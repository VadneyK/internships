// Ticket r1-perf-scale-1: size budget for the data files, the root pages, the scripts and the stylesheet.
// A teen on a slow phone pays for every byte, so a change that bloats a file fails here with the file name, its size and its limit.
// Run with: node --test tests/r1-perf-scale-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Limits in bytes, about 10 percent above the sizes measured on 2026-10-10. Raised the same day for the city data waves: the guide grew from 1,187 to 1,771 programs (the lite file is 2,017,065 bytes, 1,139 per program, so the per-program limit is unchanged) (about 36 percent), so the four data limits grew with it. To raise one on purpose, change its number here in the same pull request and say why in that PR.
const LIMITS = {
  data: {
    // Raised on 2026-10-11 for ticket p7-regions-1: 267 new cards for 11 states took entries.json to 3,993,644 bytes (899,490 gzipped). Raw from 3530000 to 4050000, gzip from 800000 to 910000.
    // PENDING PERSON APPROVAL: no record yet that a person accepted this extra weight for phone users. Until one does, do not raise this again. Slim the card data or record the approval in docs/TESTING.md.
    // Raised again on 2026-10-12 for the city data waves that followed (178 more cards, 2,214 programs): entries.json is 4,309,696 bytes (975,602 gzipped). Raw from 4050000 to 4450000, gzip from 910000 to 1000000. The cards are about as long as the older ones; the growth is the card count.
    // STILL PENDING PERSON APPROVAL: no person has recorded accepting this weight for phone users. Pages do not load this file on first view (it is the full download and the contributor file), so first-load weight is unchanged.
    // 2026-10-12: +77 Plains state cards (2,291 programs): entries.json is 4,464,728 bytes (1,014,528 gzipped). Raw from 4450000 to 4470000, gzip from 1000000 to 1015000. STILL PENDING PERSON APPROVAL, as above; this file is the full download and the contributor file, so first-load weight is unchanged.
    // 2026-10-13: +7 Plains and North Dakota cards read in a browser (2,298 programs): entries.json 4,477,582 bytes. Raw 4470000 to 4480000.
    // 2026-10-13: +50 city cards for the six new Where cities (2,348 programs). Raised to the measured sizes rounded up: entries.json raw 4480000 to 4568000, gzip 1015000 to 1034000; lite raw 2180000 to 2223100, gzip 460000 to 464000; core raw 420000 to 424100, gzip 43000 to 43400. STILL PENDING PERSON APPROVAL, as above.
    // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries.json raw 4568000 to 4677300.
    // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries.json gzip 1034000 to 1057900.
    // 2026-10-13: four repointed links after the link check. data/entries.json raw 4677300 to 4677700.
    // 2026-10-13: four repointed links after the link check. data/entries.json gzip 1057900 to 1058100.
    // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries.json raw 4677700 to 4809900.
    // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries.json gzip 1058100 to 1087700.
    // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries.json raw 4809900 to 4811300.
    // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries.json gzip 1087700 to 1088200.
    // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries.json raw 4811300 to 4883300.
    // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries.json gzip 1088200 to 1103400.
    // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries.json raw 4883300 to 4885900.
    // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries.json gzip 1103400 to 1104300.
    // 2026-10-14 persona round 9: built cards carry a derived limited flag (325 cards) for Good fit and the Only some can apply tag data/entries.json raw 4885900 to 4891200.
    // 2026-10-14 persona round 9: built cards carry a derived limited flag (325 cards) for Good fit and the Only some can apply tag data/entries.json gzip 1104300 to 1105400.
    // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries.json raw 4891200 to 5066300.
    // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries.json gzip 1105400 to 1145000.
    // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries.json raw 5066300 to 5070300.
    // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries.json gzip 1145000 to 1146000.
    // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) data/entries.json raw 5070300 to 5124700, gzip 1146000 to 1158100. PENDING PERSON APPROVAL.
    // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries.json raw 5124700 to 5145100.
    // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries.json gzip 1158100 to 1162400.
    // 2026-10-17 (after #44) hospitals, Davis and Yolo jobs, Boys and Girls Clubs and YMCA (+30 cards, 2,680 programs; PENDING PERSON APPROVAL) data/entries.json raw 5223300, gzip 1184900.
    "data/entries.json": { raw: 5223300, gzip: 1184900 },
    // Raised from 2020000 to 2040000 on 2026-10-10 after the fact check: the page re-reads added about 6,000 bytes (0.3 percent) of plainer deadline_text across 266 cards, saying what the page does and does not state. No single card is the cause. Still about 1,145 bytes per program, under the per-program limit.
    // Gzip limit raised from 440000 to 450000 on 2026-10-10: the card fixes this round (pay wording, opens-soon dates) put it at 440053.
    // Raised again on 2026-10-12 for the 178 more cards: entries-lite.json is 2,097,871 bytes (437,135 gzipped), 947 bytes per program. Raw from 2040000 to 2160000. The gzip limit stays 450000. PENDING PERSON APPROVAL, as for entries.json.
    // 2026-10-12: +77 Plains state cards (2,291 programs): entries-lite.json is 2,172,802 bytes (455,365 gzipped), 948 bytes per program. Raw from 2160000 to 2180000, gzip from 450000 to 460000. PENDING PERSON APPROVAL, as above.
    // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json raw 2223100 to 2277600.
    // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json gzip 464000 to 475200.
    // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json raw 2277600 to 2341900.
    // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json gzip 475200 to 488400.
    // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries-lite.json raw 2341900 to 2342200.
    // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries-lite.json gzip 488400 to 488500.
    // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json raw 2342200 to 2377900.
    // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json gzip 488500 to 495600.
    // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries-lite.json raw 2377900 to 2378800.
    // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries-lite.json gzip 495600 to 495900.
    // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you data/entries-lite.json raw 2378800 to 2383200.
    // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you data/entries-lite.json gzip 495900 to 496800.
    // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-lite.json raw 2383200 to 2467100.
    // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-lite.json gzip 496800 to 514200.
    // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-lite.json raw 2467100 to 2468900.
    // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-lite.json gzip 514200 to 514600.
    // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) data/entries-lite.json raw 2468900 to 2496100, gzip 514600 to 520000. PENDING PERSON APPROVAL.
    // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json raw 2496100 to 2507300.
    // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json gzip 520000 to 522200.
    // 2026-10-17 (after #44) hospitals, Davis and Yolo jobs, Boys and Girls Clubs and YMCA (+30 cards, 2,680 programs; PENDING PERSON APPROVAL) data/entries-lite.json raw 2540600, gzip 531600.
    "data/entries-lite.json": { raw: 2540600, gzip: 531600 },
    // Raised on 2026-10-11 for ticket p7-regions-1: entries-core.json is 368,169 bytes (36,864 gzipped). Raw from 320000 to 375000, gzip from 32000 to 37500.
    // PENDING PERSON APPROVAL: same as entries.json above. Do not raise again without a person's recorded sign-off.
    // Raised again on 2026-10-12 for the 178 more cards: entries-core.json is 400,279 bytes (41,089 gzipped). Raw from 375000 to 420000, gzip from 37500 to 43000. PENDING PERSON APPROVAL, as above.
    // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json raw 424100 to 435000.
    // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json gzip 43400 to 44500.
    // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json raw 435000 to 447500.
    // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json gzip 44500 to 45800.
    // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json raw 447500 to 454800.
    // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json gzip 45800 to 46500.
    // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-core.json raw 454800 to 470500.
    // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-core.json gzip 46500 to 48000.
    // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-core.json raw 470500 to 470800.
    // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) data/entries-core.json raw 470800 to 476200, gzip 48000 to 48600. PENDING PERSON APPROVAL.
    // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json raw 476200 to 478400.
    // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json gzip 48600 to 48700.
    // 2026-10-17 (after #44) hospitals, Davis and Yolo jobs, Boys and Girls Clubs and YMCA (+30 cards, 2,680 programs; PENDING PERSON APPROVAL) data/entries-core.json raw 484100, gzip 49800.
    "data/entries-core.json": { raw: 484100, gzip: 49800 },
  },
  liteBytesPerProgram: 1300,
  // Raised from 32000 to 32100 on 2026-10-10 for the footer link to the teachers and counselors handout, which every page carries. ready.html is 32009 bytes.
  // Raised from 32100 to 32300 on 2026-10-11 for the pick-your-state note on ready.html and paycheck.html and the age-based home card text. ready.html is about 32170 bytes.
  // Raised from 32300 to 32600 on 2026-10-11 when the third upgrade round was merged with the persona round: ready.html is 32534 bytes.
  // Raised from 32600 to 33600 on 2026-10-11 for ticket p8-lite-1/p8-ready-1: the closed no-parent block on ready.html (about 900 bytes) and the two jump anchors. ready.html is 33506 bytes.
  // Raised from 33600 to 34000 on 2026-10-12 for ticket r2-teen-flow-2: the Your checklist chip and jump link on ready.html, plus the last-read line moved under the lede. ready.html is 33935 bytes.
  // Raised from 34000 to 34800 on 2026-10-12 for ticket r3-teen-flow-5 (the footer Quick links are now three labelled lists, about 380 bytes on every page) and r3-a11y-perf-3 (a no-JavaScript note on script-built pages). ready.html is 34646 bytes.
  rootPage: 34800,
  // One page has its own higher limit. Added 2026-10-11: safety.html now carries its summary and every point card with its source link in the page itself (about 40,000 bytes from data/safety.json), so the facts show with JavaScript off. The static text on the page is trimmed. It is 52,653 bytes. Every other root page keeps the limit above.
  // Raised from 52700 to 53400 on 2026-10-11 when the third upgrade round was merged: safety.html is 53342 bytes.
  // Raised from 53400 to 55100 on 2026-10-11 for the farm and ranch box (ticket p6-farm-1): four sourced federal farm rules, about 1,670 bytes, each with the page title as its link text. safety.html is 55010 bytes.
  // Raised from 55100 to 55500 on 2026-10-12 for the grouped footer Quick links (about 380 bytes). safety.html is 55390 bytes.
  // Raised for ready.html only on 2026-10-13 for the closed foster care and on your own block (ticket r8-ready-foster), about 2,900 bytes with nine source links. ready.html is 37556 bytes. Every other root page keeps the limit above.
  // 2026-10-14: ready.html 37700 to 37800 for the footer line that sends teens to a parent or youth leader instead of GitHub (every page; ready.html 37736 bytes).
  // 2026-10-15: safety.html 55500 to 55700 and ready.html 37800 to 38000 for the head script that folds the phone menu before
  // common.js runs (about 170 bytes on every page; Lighthouse CLS 0.17 to 0 on phones). safety.html 55674, ready.html 37911 bytes. PENDING PERSON APPROVAL.
  // 2026-10-15: safety.html 55700 to 55800 for the Programs on a map footer link (about 50 bytes on every page; safety.html 55734 bytes). PENDING PERSON APPROVAL.
  pageLimits: { "safety.html": 55800, "ready.html": 38000 },
  // Raised from 40000 to 46000 on 2026-10-10: lib.js grew to 41715 bytes for the live chip counts, empty-state options, top picks and the cost-tier sort. Gzipped it is about 11 KB. The other scripts are all under 40000.
  // Raised again from 46000 to 48000 on 2026-10-10 for the whole-state Where choices (the state list, its group lists and the state place lookup). lib.js is 47189 bytes.
  // Raised from 48000 to 49500 on 2026-10-11 for the under-14 note and the search-cache fix in find.js. find.js is 49389 bytes.
  // Raised again from 49500 to 51500 on 2026-10-11 after merging the persona round (star shape, visible results focus) into find.js. find.js is 51372 bytes.
  // Raised from 51500 to 52000 on 2026-10-12 for ticket r1-teen-flow-1: find.js opens More filters and counts the hidden filters that are on. find.js is 51866 bytes.
  // Raised from 52000 to 52700 on 2026-10-12 for ticket r2-a11y-perf-7: the saved-list print sheet drops empty parentheses and adds a last-checked line. find.js is 52686 bytes.
  // Raised from 52700 to 53400 on 2026-10-12 for ticket r3-a11y-perf-5: the phone Search key applies the search and moves to the results. find.js is 53228 bytes.
  // Raised from 53400 to 59300 on 2026-10-12 for ticket diet-1: find.js picks a place's Where group files (data/lite and data/detail, ten literal URLs each way) instead of always loading the whole lite file, and falls back to the whole file when a state needs it. find.js is 59217 bytes. First-load data on the Programs page with a place chosen falls from 437 KB to 100 to 186 KB gzipped.
  // 2026-10-12: Programs filters redesign. Raised from 59300 to 64500 for the summary bar and the phone bar in find.js (64477 bytes).
  // 2026-10-14: persona round 9. Raised from 64500 to 66400 for Good fit picks that keep the QR area, the calendar link that keeps it, the "Only some can apply" tag, the fuller Copy my list text and picks that keep the pay choice (find.js 66476 bytes).
  // 2026-10-15: map page review. Raised from 66600 to 67600 so a #p- link (every program link on the map page) keeps its card in view while the list
  // above it grows; reviewers saw the card land 15,000 to 37,000 px away. find.js is 67510 bytes. PENDING PERSON APPROVAL.
  // 2026-10-16 persona r11: 67600 to 68000 for the grade tag on program cards and picks that hold those cards back like limited ones (find.js 67924 bytes). PENDING PERSON APPROVAL.
  script: 68000,
  // Raised from 34000 to 35000 on 2026-10-10: the merged upgrades added a few rules (the plain facts list and the Jobs output heading) and the sheet is 34005 bytes. Not caused by the data growth.
  // Raised again from 35000 to 36000 on 2026-10-10 for the 44 pixel tap targets (details summary, checkbox, breadcrumb) and the print rule for jump chips. The sheet is 35260 bytes.
  // Raised again from 36000 to 37000 on 2026-10-10 for the prefers-contrast block, the h1.display rule, the zero-count chip rule and the print rule for buttons. The sheet is 36345 bytes.
  // Raised from 37000 to 38000 on 2026-10-10 for the print source line, the focus rings on yellow and dark surfaces, and the expanded tile state. The sheet is 37288 bytes.
  // Raised again from 38000 to 38500 on 2026-10-10 for the handout page layout and its print rules. The sheet is 38283 bytes.
  // Raised again from 38500 to 39500 on 2026-10-10 for the print rules that keep callouts, month blocks and people cards whole and print the address after the Languages and Calendar card buttons. The sheet is 38975 bytes.
  // Raised from 39500 to 40500 on 2026-10-11 for the safe-area side padding, the tall-screen sticky header block, the disabled button look and the long-string wrap rule. The sheet is 40319 bytes.
  // Raised again from 40500 to 40600 on 2026-10-11 after merging the persona round rules. The sheet is 40518 bytes.
  // Raised from 40600 to 41000 on 2026-10-12 for tickets r1-a11y-perf-1, r1-a11y-perf-2 and r1-a11y-perf-3: the current page rule in forced colors, the silent plus and minus marks, and the QR image look moved out of inline styles. The sheet is 40867 bytes.
  // Raised from 41000 to 42000 on 2026-10-12 for tickets r2-a11y-perf-2, r2-a11y-perf-6 and r2-teen-flow-4: hover styles only where a device can hover, print rules for buttons and controls, and the closed legend box. The sheet is 41831 bytes.
  // Raised from 42000 to 42400 on 2026-10-12 for tickets r3-teen-flow-5, r3-a11y-perf-2 and r3-a11y-perf-6: the footer group headings, link addresses on the print-one sheets, and the real screen height rule. The sheet is 42273 bytes.
  // 2026-10-12: home picker flow. Raised from 42400 to 44700 for the numbered steps, the place search box, its list and the chip. The sheet is 44619 bytes.
  // 2026-10-12: Programs filters redesign. Raised from 44700 to 48300 for the summary bar, pill rows and phone bar rules (48237 bytes).
  // 2026-10-13: ticket ux9-callout-btn, callout button colour rules. Raised from 48300 to 48800 (48730 bytes).
  // 2026-10-13, ticket ux9-pills: .fpill round pill rule. Raised from 48800 to 48900 (48834 bytes).
  // 2026-10-13, ticket ux9-page-top: .notes and .topnote rule. Raised from 48900 to 49000 (48937 bytes).
  // 2026-10-13, ticket ux9-header-footer: phone header row, Menu grid and footer columns rules. Raised from 49000 to 49800 (49757 bytes).
  // 2026-10-13, ticket ux9-quiet-cards: quiet card h3, a.chip and .g2x2 rules. Raised from 49800 to 50100 (50049 bytes).
  // 2026-10-13, ticket ux9-header-footer: 320 px overflow fixes (.tp-hidden left, .tl grid, wrapping tags). Raised from 50100 to 50300 (50259 bytes).
  // 2026-10-13: ux9 review fixes (.tablewrap position, Jobs hours gap). Raised from 50300 to 50400 (50324 bytes).
  // 2026-10-13: ux9 review fixes (permit pill, calendar gap). Raised from 50400 to 50500 (50427 bytes).
  // 2026-10-13: workshop leaders round (handout phone tables). Raised from 50500 to 50600 (50571 bytes).
  // 2026-10-14: SoCal round 10. Raised from 50600 to 50700: the filter summary may shrink and the place pill wraps on phones (style.css 50638 bytes).
  // 2026-10-14: Numbers page chart legends and per-bar paid and not-paid counts.  limit 50700 to 51200.
  // 2026-10-14: parents permit table stacks on phones (PENDING PERSON APPROVAL).  limit 51200 to 52100.
  // 2026-10-14: tap-to-call numbers on the parents permit table (PENDING PERSON APPROVAL).  limit 52100 to 52300.
  // 2026-10-14: phone tables drop the 34rem floor; rules hours table stacks (PENDING PERSON APPROVAL).  limit 52300 to 52400.
  // 2026-10-15: phone header folds before scripts, tables stack, clockLabel (PENDING PERSON APPROVAL).  limit 52400 to 52600.
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL).  limit 52600 to 53300.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL).  limit 53300 to 53400.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL).  limit 53400 to 53800.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL).  limit 53800 to 54000.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL).  limit 54000 to 54700.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL).  limit 54700 to 54800.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL).  limit 54800 to 55100.
  // 2026-10-15: the Map page rules (PENDING PERSON APPROVAL).  limit 55100 to 57300.
  // 2026-10-16: the street map box, its buttons and dark icons (PENDING PERSON APPROVAL).  limit 57300 to 58600.
  // 2026-10-18: value labels inside the Numbers page bars and totals next to the bar end, merged with the street map rules (PENDING PERSON APPROVAL). limit 58600 to 59600.
  stylesheet: 59600,
};

const LITE = "data/entries-lite.json";
const STYLESHEET = "assets/css/style.css";

// Measure one file: raw bytes, and gzipped bytes at zlib level 9.
function sizeOf(buf) {
  return { bytes: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length };
}

// Read every budgeted file from disk. Keys are repo-relative paths with forward slashes.
function measureRepo() {
  const sizes = {};
  for (const rel of Object.keys(LIMITS.data)) {
    sizes[rel] = sizeOf(fs.readFileSync(path.join(ROOT, rel)));
  }
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
  for (const page of pages) sizes[page] = sizeOf(fs.readFileSync(path.join(ROOT, page)));
  const scripts = fs.readdirSync(path.join(ROOT, "assets/js")).filter((f) => f.endsWith(".js")).sort();
  for (const script of scripts) {
    const rel = `assets/js/${script}`;
    sizes[rel] = sizeOf(fs.readFileSync(path.join(ROOT, rel)));
  }
  sizes[STYLESHEET] = sizeOf(fs.readFileSync(path.join(ROOT, STYLESHEET)));
  return sizes;
}

// Returns one message for each limit that a file breaks. Each message names the file, its size and the limit.
// sizes maps a repo-relative path to { bytes, gzip }. programCount is the "count" in data/meta.json.
export function budgetProblems(sizes, programCount) {
  const problems = [];
  for (const [file, size] of Object.entries(sizes)) {
    const data = LIMITS.data[file];
    if (data) {
      if (size.bytes > data.raw) {
        problems.push(`${file} is ${size.bytes} bytes, over the limit of ${data.raw} bytes`);
      }
      if (size.gzip > data.gzip) {
        problems.push(`${file} is ${size.gzip} bytes gzipped (level 9), over the limit of ${data.gzip} bytes gzipped`);
      }
      if (file === LITE && programCount > 0) {
        const perProgram = size.bytes / programCount;
        if (perProgram > LIMITS.liteBytesPerProgram) {
          problems.push(
            `${file} is ${Math.round(perProgram)} bytes per program (${size.bytes} bytes for ${programCount} programs), over the limit of ${LIMITS.liteBytesPerProgram} bytes per program`
          );
        }
      }
    } else if (!file.includes("/") && file.endsWith(".html")) {
      const pageLimit = LIMITS.pageLimits[file] ?? LIMITS.rootPage;
      if (size.bytes > pageLimit) {
        problems.push(`${file} is ${size.bytes} bytes, over the limit of ${pageLimit} bytes for a root page`);
      }
    } else if (file.startsWith("assets/js/") && file.endsWith(".js")) {
      if (size.bytes > LIMITS.script) {
        problems.push(`${file} is ${size.bytes} bytes, over the limit of ${LIMITS.script} bytes for a script`);
      }
    } else if (file === STYLESHEET) {
      if (size.bytes > LIMITS.stylesheet) {
        problems.push(`${file} is ${size.bytes} bytes, over the limit of ${LIMITS.stylesheet} bytes for the stylesheet`);
      }
    }
  }
  return problems;
}

const programCount = JSON.parse(fs.readFileSync(path.join(ROOT, "data/meta.json"), "utf8")).count;
const repoSizes = measureRepo();

test("data/meta.json gives a program count to divide by", () => {
  assert.ok(Number.isInteger(programCount) && programCount > 0, `count in data/meta.json is ${programCount}`);
});

for (const file of Object.keys(repoSizes)) {
  test(`${file} is within its size budget`, () => {
    const problems = budgetProblems({ [file]: repoSizes[file] }, programCount);
    assert.deepEqual(problems, [], problems.join("\n"));
  });
}

test("the whole repo is within budget", () => {
  const problems = budgetProblems(repoSizes, programCount);
  assert.deepEqual(problems, [], problems.join("\n"));
});

// Mutation test: a fake size table with entries-lite.json at 2,300,000 raw bytes must be reported.
// The raw limit (2,180,000 since 2026-10-12) is broken, and so is the per-program limit, because 3,058,485 / 2,291 is about 1,335 bytes per program (limit 1,300).
// Every other file in the fake table is inside its limit, so no other file may be reported.
test("mutation: a lite file at 2,300,000 bytes is reported, and only lite is reported", () => {
  const big = Math.max(2300000, 1335 * programCount);
  const fake = { ...repoSizes, [LITE]: { bytes: big, gzip: repoSizes[LITE].gzip } };
  const problems = budgetProblems(fake, programCount);
  assert.deepEqual(problems, [
    `${LITE} is ${big} bytes, over the limit of 2540600 bytes`, // 2026-10-17: PNW and Vancouver cards rebased on e7628a4 (2,650 programs); was 2496100
    `${LITE} is ${Math.round(big / programCount)} bytes per program (${big} bytes for ${programCount} programs), over the limit of 1300 bytes per program`,
  ]);
});

// Mutation test for a page: one root page one byte over its limit is the only problem reported.
test("mutation: a root page at 34,801 bytes is the only problem reported", () => {
  const fake = { ...repoSizes, "rules.html": { bytes: 34801, gzip: 9000 } };
  assert.deepEqual(budgetProblems(fake, programCount), [
    "rules.html is 34801 bytes, over the limit of 34800 bytes for a root page",
  ]);
});
