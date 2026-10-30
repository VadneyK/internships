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
  // 2026-10-16: the street map's pinned libraries (MapLibre GL JS 6.11.2, PMTiles 4.5.0); they change only with a version bump
  { dir: "assets/vendor", ext: ".js" },
  { dir: "assets/vendor/maplibre", ext: null },
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
  // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries-core.json limit 476200 to 478400.
  // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) data/entries-core.json limit 470800 to 476200. PENDING PERSON APPROVAL.
  // 2026-10-17 (after #44) hospitals, Davis and Yolo jobs, Boys and Girls Clubs and YMCA (+30 cards, 2,680 programs; PENDING PERSON APPROVAL) data/entries-core.json limit 484100.
  // 2026-10-18 (after #45) issue 19 Southern California pages read in a real browser (+6 cards, 2,686 programs; PENDING PERSON APPROVAL): 484100 to 485200.
  // 2026-10-18 (after #54) issue 22 Chicago and Elgin second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 484100 to 485500.
  // 2026-10-19: issue 19 second pass (#59) and issue 22 second pass (#60) together, 486478 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-core.json ceiling 485500 to 486500.
  // 2026-10-19 issue 23 Pacific Northwest and Vancouver second pass read in a real browser (+15 cards, 2,695 programs; PENDING PERSON APPROVAL): 484100 to 486900.
  // 2026-10-19: the 15 PNW cards (#65) after #59, #60 and #64, 489233 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-core.json ceiling 486900 to 489300.
  // 2026-10-19 issues 20, 21 and 26 East Coast second pass read in a real browser (+9 cards, 2,689 programs; PENDING PERSON APPROVAL): 484100 to 485800.
  // 2026-10-19: the 9 East Coast cards (#66) after #59, #60, #64 and #65, 490905 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-core.json ceiling 489300 to 491000.
  // 2026-10-17 Bay Area city pass for issues 1 and 2 merged onto main (2,724 programs). PENDING PERSON APPROVAL. data/entries-core.json limit 484100 to 492300.
  // 2026-10-19: the 44 Bay Area city cards (#43) after #59, #60, #62, #64, #65 and #66, 499081 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-core.json ceiling 492300 to 499100.
  // 2026-10-17 (after #45) SoCal, Santa Barbara and Merced cards read in a real browser (+16 cards, 2,696 programs; PENDING PERSON APPROVAL): 484100 to 487200.
  // 2026-10-19: the 16 Southern California, Santa Barbara and Merced cards (#49) after #43, 502100 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-core.json ceiling 499100 to 502200.
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,700 programs) data/entries-core.json limit 484100 to 487800. PENDING PERSON APPROVAL.
  // 2026-10-19: the 20 Midwest and Texas cards (#50) after #43 and #49, 505782 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-core.json ceiling 502200 to 505800.
  // 2026-10-19 issue 27 San Diego, Inland Empire and Merced second pass, official pages read by hand (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 484100 to 485300.
  // 2026-10-19: the 7 San Diego, Pomona and Merced cards (#67) after #43 to #52, 506994 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-core.json ceiling 505800 to 507000.
  // 2026-10-19 issue 25 Midwest campuses second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL) data/entries-core.json limit 484100 to 485400.
  // 2026-10-19: the 7 Michigan and Ohio campus cards (#68) after #67, 508275 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-core.json ceiling 507000 to 508300.
  // 2026-10-19 issue 24 Texas and Twin Cities second pass read in a real browser (+6 cards, 2,692 programs; PENDING PERSON APPROVAL): 485200 to 486300.
  // 2026-10-19: the Texas and Twin Cities cards (#69) after #68, 509393 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-core.json ceiling 508300 to 509400.
  // 2026-10-26: three Inland Empire cards (Corona, Rancho Cucamonga) on top of PRs 98 to 101. PENDING PERSON APPROVAL. 509400 to 510000 (509961 measured).
  "data/entries-core.json": { ceiling: 510000, reason: "data file, 368201 bytes measured 2026-10-10" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-detail.json ceiling 1731000 to 1772700.
  // 2026-10-13: four repointed links after the link check. data/entries-detail.json limit 1772700 to 1772900.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-detail.json limit 1772900 to 1823500.
  // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries-detail.json limit 1823500 to 1824500.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-detail.json limit 1824500 to 1851500.
  // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries-detail.json limit 1851500 to 1853200.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-detail.json limit 1853200 to 1921000.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-detail.json limit 1921000 to 1922700.
  // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries-detail.json limit 1942900 to 1948300.
  // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) data/entries-detail.json limit 1922700 to 1942900. PENDING PERSON APPROVAL.
  // 2026-10-17 (after #44) hospitals, Davis and Yolo jobs, Boys and Girls Clubs and YMCA (+30 cards, 2,680 programs; PENDING PERSON APPROVAL) data/entries-detail.json limit 1980900.
  // 2026-10-18: issue 28 link fixes (30 field edits on 10 cards), 1981223 bytes. Approved by Kentaro 2026-10-18. data/entries-detail.json ceiling 1980900 to 1981300.
  // 2026-10-18 (after #45) issue 19 Southern California pages read in a real browser (+6 cards, 2,686 programs; PENDING PERSON APPROVAL): 1980900 to 1986700.
  // 2026-10-19: issue 28 batch 1 (#56) plus issue 19 second pass (#59) together, 1987013 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 1986700 to 1987100.
  // 2026-10-18 (after #54) issue 22 Chicago and Elgin second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 1980900 to 1985300.
  // 2026-10-19: issue 19 second pass (#59) and issue 22 second pass (#60) together, 1991400 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 1987100 to 1991500.
  // 2026-10-19 issue 5 Confirm first: CHP East Sacramento and Michigan 4-H Exploration Days re-read in a real browser (2 cards changed, 2,680 programs; PENDING PERSON APPROVAL) data/entries-detail.json limit 1980900 to 1981400.
  // 2026-10-19: confirm-first edits (#64) after the #59 and #60 cards, 1991831 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 1991500 to 1991900.
  // 2026-10-19 issue 23 Pacific Northwest and Vancouver second pass read in a real browser (+15 cards, 2,695 programs; PENDING PERSON APPROVAL): 1980900 to 1991700.
  // 2026-10-19: the 15 PNW cards (#65) after #59, #60 and #64, 2002573 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 1991900 to 2002600.
  // 2026-10-19: the 15 PNW cards (#65) after #59, #60 and #64, 2002607 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2002600 to 2002700.
  // 2026-10-19 issues 20, 21 and 26 East Coast second pass read in a real browser (+9 cards, 2,689 programs; PENDING PERSON APPROVAL): 1980900 to 1987500.
  // 2026-10-19: the 9 East Coast cards (#66) after #59, #60, #64 and #65, 2009146 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2002700 to 2009200.
  // 2026-10-17 Bay Area city pass for issues 1 and 2 merged onto main (2,724 programs). PENDING PERSON APPROVAL. data/entries-detail.json limit 1980900 to 2018800.
  // 2026-10-19: the 44 Bay Area city cards (#43) after #59, #60, #62, #64, #65 and #66, 2046970 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2018800 to 2047000.
  // 2026-10-17 (after #45) SoCal, Santa Barbara and Merced cards read in a real browser (+16 cards, 2,696 programs; PENDING PERSON APPROVAL): 1980900 to 1993500.
  // 2026-10-19: the 16 Southern California, Santa Barbara and Merced cards (#49) after #43, 2059542 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2047000 to 2059600.
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,700 programs) data/entries-detail.json limit 1980900 to 1995400. PENDING PERSON APPROVAL.
  // 2026-10-19: the 20 Midwest and Texas cards (#50) after #43 and #49, 2074102 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2059600 to 2074200.
  // 2026-10-19 issue 27 San Diego, Inland Empire and Merced second pass, official pages read by hand (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 1980900 to 1986800.
  // 2026-10-19: the 7 San Diego, Pomona and Merced cards (#67) after #43 to #52, 2079927 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2074200 to 2080000.
  // 2026-10-19 issue 25 Midwest campuses second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL) data/entries-detail.json limit 1981300 to 1987200.
  // 2026-10-19: the 7 Michigan and Ohio campus cards (#68) after #67, 2085877 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2080000 to 2085900.
  // 2026-10-19: the 7 Michigan and Ohio campus cards (#68) after #67, 2085920 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2085900 to 2086000.
  // 2026-10-19 issue 24 Texas and Twin Cities second pass read in a real browser (+6 cards, 2,692 programs; PENDING PERSON APPROVAL): 1987100 to 1991500.
  // 2026-10-19: the Texas and Twin Cities cards (#69) after #68, 2090385 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2086000 to 2090400.
  // 2026-10-19: the Texas and Twin Cities cards (#69) after #68, 2090418 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-detail.json ceiling 2090400 to 2090500.
  // 2026-10-26: three Inland Empire cards (Corona, Rancho Cucamonga) on top of PRs 98 to 101. PENDING PERSON APPROVAL. 2090500 to 2091800 (2091776 measured).
  "data/entries-detail.json": { ceiling: 2091800, reason: "data file, 1521373 bytes measured 2026-10-10" },
  "data/entries-home.json": { ceiling: 899400, reason: "data file, 817599 bytes measured 2026-10-10" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json ceiling 2223100 to 2277600.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json limit 2277600 to 2341900.
  // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries-lite.json limit 2341900 to 2342200.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json limit 2342200 to 2377900.
  // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries-lite.json limit 2377900 to 2378800.
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you data/entries-lite.json limit 2378800 to 2383200.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-lite.json limit 2383200 to 2467100.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-lite.json limit 2467100 to 2468900.
  // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries-lite.json limit 2496100 to 2507300.
  // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) data/entries-lite.json limit 2468900 to 2496100. PENDING PERSON APPROVAL.
  // 2026-10-17 (after #44) hospitals, Davis and Yolo jobs, Boys and Girls Clubs and YMCA (+30 cards, 2,680 programs; PENDING PERSON APPROVAL) data/entries-lite.json limit 2540600.
  // 2026-10-18 (after #45) issue 19 Southern California pages read in a real browser (+6 cards, 2,686 programs; PENDING PERSON APPROVAL): 2540600 to 2546800.
  // 2026-10-18 (after #54) issue 22 Chicago and Elgin second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 2540600 to 2547400.
  // 2026-10-19: issue 19 second pass (#59) and issue 22 second pass (#60) together, 2553402 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2547400 to 2553500.
  // 2026-10-19 issue 5 Confirm first: CHP East Sacramento and Michigan 4-H Exploration Days re-read in a real browser (2 cards changed, 2,680 programs; PENDING PERSON APPROVAL) data/entries-lite.json limit 2540600 to 2540800.
  // 2026-10-19: confirm-first edits (#64) after the #59 and #60 cards, 2553569 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2553500 to 2553600.
  // 2026-10-19 issue 23 Pacific Northwest and Vancouver second pass read in a real browser (+15 cards, 2,695 programs; PENDING PERSON APPROVAL): 2540600 to 2554500.
  // 2026-10-19: the 15 PNW cards (#65) after #59, #60 and #64, 2567354 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2554500 to 2567400.
  // 2026-10-19 issues 20, 21 and 26 East Coast second pass read in a real browser (+9 cards, 2,689 programs; PENDING PERSON APPROVAL): 2540600 to 2549200.
  // 2026-10-19: the 9 East Coast cards (#66) after #59, #60, #64 and #65, 2575944 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2567400 to 2576000.
  // 2026-10-17 Bay Area city pass for issues 1 and 2 merged onto main (2,724 programs). PENDING PERSON APPROVAL. data/entries-lite.json limit 2540600 to 2584100.
  // 2026-10-19: the 44 Bay Area city cards (#43) after #59, #60, #62, #64, #65 and #66, 2619357 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2584100 to 2619400.
  // 2026-10-17 (after #45) SoCal, Santa Barbara and Merced cards read in a real browser (+16 cards, 2,696 programs; PENDING PERSON APPROVAL): 2540600 to 2555400.
  // 2026-10-19: the 16 Southern California, Santa Barbara and Merced cards (#49) after #43, 2634217 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2619400 to 2634300.
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,700 programs) data/entries-lite.json limit 2540600 to 2560200. PENDING PERSON APPROVAL.
  // 2026-10-19: the 20 Midwest and Texas cards (#50) after #43 and #49, 2653835 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2634300 to 2653900.
  // 2026-10-19 issue 27 San Diego, Inland Empire and Merced second pass, official pages read by hand (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 2540600 to 2547400.
  // 2026-10-19: the 7 San Diego, Pomona and Merced cards (#67) after #43 to #52, 2660641 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2653900 to 2660700.
  // 2026-10-19 issue 25 Midwest campuses second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL) data/entries-lite.json limit 2540600 to 2547400.
  // 2026-10-19: the 7 Michigan and Ohio campus cards (#68) after #67, 2667460 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2660700 to 2667500.
  // 2026-10-19 issue 24 Texas and Twin Cities second pass read in a real browser (+6 cards, 2,692 programs; PENDING PERSON APPROVAL): 2546800 to 2552700.
  // 2026-10-19: the Texas and Twin Cities cards (#69) after #68, 2673498 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2667500 to 2673500.
  // 2026-10-19: the Texas and Twin Cities cards (#69) after #68, 2673515 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-lite.json ceiling 2673500 to 2673600.
  // 2026-10-26: three Inland Empire cards (Corona, Rancho Cucamonga) on top of PRs 98 to 101. PENDING PERSON APPROVAL. 2673600 to 2675500 (2675461 measured).
  "data/entries-lite.json": { ceiling: 2675500, reason: "data file, 1937500 bytes measured 2026-10-10" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries-stats.json ceiling 697700 to 716100.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries-stats.json limit 716100 to 736500.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries-stats.json limit 736500 to 748900.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries-stats.json limit 748900 to 776000.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries-stats.json limit 776000 to 776700.
  // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries-stats.json limit 785100 to 788200.
  // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) data/entries-stats.json limit 776700 to 785100. PENDING PERSON APPROVAL.
  // 2026-10-17 (after #44) hospitals, Davis and Yolo jobs, Boys and Girls Clubs and YMCA (+30 cards, 2,680 programs; PENDING PERSON APPROVAL) data/entries-stats.json limit 798100.
  // 2026-10-18 (after #45) issue 19 Southern California pages read in a real browser (+6 cards, 2,686 programs; PENDING PERSON APPROVAL): 798100 to 800000.
  // 2026-10-18 (after #54) issue 22 Chicago and Elgin second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 798100 to 800300.
  // 2026-10-19: issue 19 second pass (#59) and issue 22 second pass (#60) together, 801984 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-stats.json ceiling 800300 to 802000.
  // 2026-10-19 issue 23 Pacific Northwest and Vancouver second pass read in a real browser (+15 cards, 2,695 programs; PENDING PERSON APPROVAL): 798100 to 802200.
  // 2026-10-19: the 15 PNW cards (#65) after #59, #60 and #64, 806131 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-stats.json ceiling 802200 to 806200.
  // 2026-10-19 issues 20, 21 and 26 East Coast second pass read in a real browser (+9 cards, 2,689 programs; PENDING PERSON APPROVAL): 798100 to 800700.
  // 2026-10-19: the 9 East Coast cards (#66) after #59, #60, #64 and #65, 808798 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-stats.json ceiling 806200 to 808800.
  // 2026-10-17 Bay Area city pass for issues 1 and 2 merged onto main (2,724 programs). PENDING PERSON APPROVAL. data/entries-stats.json limit 798100 to 811900.
  // 2026-10-19: the 44 Bay Area city cards (#43) after #59, #60, #62, #64, #65 and #66, 822613 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-stats.json ceiling 811900 to 822700.
  // 2026-10-17 (after #45) SoCal, Santa Barbara and Merced cards read in a real browser (+16 cards, 2,696 programs; PENDING PERSON APPROVAL): 798100 to 802900.
  // 2026-10-19: the 16 Southern California, Santa Barbara and Merced cards (#49) after #43, 827451 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-stats.json ceiling 822700 to 827500.
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,700 programs) data/entries-stats.json limit 798100 to 804000. PENDING PERSON APPROVAL.
  // 2026-10-19: the 20 Midwest and Texas cards (#50) after #43 and #49, 833395 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-stats.json ceiling 827500 to 833400.
  // 2026-10-19 issue 27 San Diego, Inland Empire and Merced second pass, official pages read by hand (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 798100 to 799900.
  // 2026-10-19: the 7 San Diego, Pomona and Merced cards (#67) after #43 to #52, 835195 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-stats.json ceiling 833400 to 835200.
  // 2026-10-19 issue 25 Midwest campuses second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL) data/entries-stats.json limit 798100 to 800100.
  // 2026-10-19: the 7 Michigan and Ohio campus cards (#68) after #67, 837220 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-stats.json ceiling 835200 to 837300.
  // 2026-10-19 issue 24 Texas and Twin Cities second pass read in a real browser (+6 cards, 2,692 programs; PENDING PERSON APPROVAL): 800000 to 801700.
  // 2026-10-19: the Texas and Twin Cities cards (#69) after #68, 839072 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries-stats.json ceiling 837300 to 839100.
  // 2026-10-26: three Inland Empire cards (Corona, Rancho Cucamonga) on top of PRs 98 to 101. PENDING PERSON APPROVAL. 839100 to 839900 (839816 measured).
  "data/entries-stats.json": { ceiling: 839900, reason: "data file, 606782 bytes measured 2026-10-10" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. data/entries.json ceiling 4567200 to 4677300.
  // 2026-10-13: four repointed links after the link check. data/entries.json limit 4677300 to 4677700.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. data/entries.json limit 4677700 to 4809900.
  // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). data/entries.json limit 4809900 to 4811300.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. data/entries.json limit 4811300 to 4883300.
  // 2026-10-13: re-read of 213 more open cards (42 fixed). data/entries.json limit 4883300 to 4885900.
  // 2026-10-14 persona round 9: built cards carry a derived limited flag (325 cards) for Good fit and the Only some can apply tag data/entries.json limit 4885900 to 4891200.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) data/entries.json limit 4891200 to 5066300.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) data/entries.json limit 5066300 to 5070300.
  // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. data/entries.json limit 5124700 to 5145100.
  // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) data/entries.json limit 5070300 to 5124700. PENDING PERSON APPROVAL.
  // 2026-10-17 (after #44) hospitals, Davis and Yolo jobs, Boys and Girls Clubs and YMCA (+30 cards, 2,680 programs; PENDING PERSON APPROVAL) data/entries.json limit 5223300.
  // 2026-10-18: issue 28 link fixes (30 field edits on 10 cards), 5223647 bytes. Approved by Kentaro 2026-10-18. data/entries.json ceiling 5223300 to 5223700.
  // 2026-10-18 (after #45) issue 19 Southern California pages read in a real browser (+6 cards, 2,686 programs; PENDING PERSON APPROVAL): 5223300 to 5237200.
  // 2026-10-19: issue 28 batch 1 (#56) plus issue 19 second pass (#59) together, 5237550 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5237200 to 5237600.
  // 2026-10-18 (after #54) issue 22 Chicago and Elgin second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 5223300 to 5236500.
  // 2026-10-19: issue 19 second pass (#59) and issue 22 second pass (#60) together, 5250719 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5237600 to 5250800.
  // 2026-10-19 issue 5 Confirm first: CHP East Sacramento and Michigan 4-H Exploration Days re-read in a real browser (2 cards changed, 2,680 programs; PENDING PERSON APPROVAL) data/entries.json limit 5223300 to 5224400.
  // 2026-10-19: confirm-first edits (#64) after the #59 and #60 cards, 5251805 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5250800 to 5251900.
  // 2026-10-19 issue 23 Pacific Northwest and Vancouver second pass read in a real browser (+15 cards, 2,695 programs; PENDING PERSON APPROVAL): 5223300 to 5251800.
  // 2026-10-19: the 15 PNW cards (#65) after #59, #60 and #64, 5280270 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5251900 to 5280300.
  // 2026-10-19: the 15 PNW cards (#65) after #59, #60 and #64, 5280304 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5280300 to 5280400.
  // 2026-10-19 issues 20, 21 and 26 East Coast second pass read in a real browser (+9 cards, 2,689 programs; PENDING PERSON APPROVAL): 5223300 to 5240900.
  // 2026-10-19: the 9 East Coast cards (#66) after #59, #60, #64 and #65, 5297955 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5280400 to 5298000.
  // 2026-10-17 Bay Area city pass for issues 1 and 2 merged onto main (2,724 programs). PENDING PERSON APPROVAL. data/entries.json limit 5223300 to 5320000.
  // 2026-10-19: the 44 Bay Area city cards (#43) after #59, #60, #62, #64, #65 and #66, 5394594 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5320000 to 5394600.
  // 2026-10-19: the 44 Bay Area city cards (#43) after #59, #60, #62, #64, #65 and #66, 5394608 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5394600 to 5394700.
  // 2026-10-17 (after #45) SoCal, Santa Barbara and Merced cards read in a real browser (+16 cards, 2,696 programs; PENDING PERSON APPROVAL): 5223300 to 5254900.
  // 2026-10-19: the 16 Southern California, Santa Barbara and Merced cards (#49) after #43, 5426198 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5394700 to 5426200.
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,700 programs) data/entries.json limit 5223300 to 5263300. PENDING PERSON APPROVAL.
  // 2026-10-19: the 20 Midwest and Texas cards (#50) after #43 and #49, 5466315 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5426200 to 5466400.
  // 2026-10-19 issue 27 San Diego, Inland Empire and Merced second pass, official pages read by hand (+7 cards, 2,687 programs; PENDING PERSON APPROVAL): 5223300 to 5237900.
  // 2026-10-19: the 7 San Diego, Pomona and Merced cards (#67) after #43 to #52, 5481016 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5466400 to 5481100.
  // 2026-10-19 issue 25 Midwest campuses second pass read in a real browser (+7 cards, 2,687 programs; PENDING PERSON APPROVAL) data/entries.json limit 5223700 to 5238500.
  // 2026-10-19: the 7 Michigan and Ohio campus cards (#68) after #67, 5495797 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5481100 to 5495800.
  // 2026-10-19: the 7 Michigan and Ohio campus cards (#68) after #67, 5495840 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5495800 to 5495900.
  // 2026-10-19 issue 24 Texas and Twin Cities second pass read in a real browser (+6 cards, 2,692 programs; PENDING PERSON APPROVAL): 5237600 to 5250100.
  // 2026-10-19: the Texas and Twin Cities cards (#69) after #68, 5508369 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5495900 to 5508400.
  // 2026-10-19: the Texas and Twin Cities cards (#69) after #68, 5508419 bytes. Approved by Kentaro 2026-10-19 (merge train). data/entries.json ceiling 5508400 to 5508500.
  // 2026-10-26: three Inland Empire cards (Corona, Rancho Cucamonga) on top of PRs 98 to 101. PENDING PERSON APPROVAL. 5508500 to 5512500 (5512401 measured).
  "data/entries.json": { ceiling: 5512500, reason: "data file, 3996617 bytes measured 2026-10-10" },
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
  "data/wages-2027.json": { ceiling: 16000, reason: "2027 minimum wage reads for issue 7, 11679 bytes measured 2026-10-18; read only by tests and hand edits, never by a page" },
  // 2026-10-26: issue 9. style.css 59600 to 59700 (map control focus ring rule; 59652 bytes).
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
  // 2026-10-15: callout contrast and find skip link (PENDING PERSON APPROVAL). assets/css/style.css limit 52600 to 53300.
  // 2026-10-15: build-time tiles and notes so pickers keep their space (CLS) (PENDING PERSON APPROVAL). assets/css/style.css limit 53300 to 53400.
  // 2026-10-15: target size, hero glow, focus above the Show bar (PENDING PERSON APPROVAL). assets/css/style.css limit 53400 to 53800.
  // 2026-10-15: opened tile style (PENDING PERSON APPROVAL). assets/css/style.css limit 53800 to 54000.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). assets/css/style.css limit 54000 to 54700.
  // 2026-10-15: narrow phone header and headings (PENDING PERSON APPROVAL). assets/css/style.css limit 54700 to 54800.
  // 2026-10-15: brand wraps instead of the header row (PENDING PERSON APPROVAL). assets/css/style.css limit 54800 to 55100.
  "assets/css/style.css": { ceiling: 59700, reason: "stylesheet, 41831 bytes measured 2026-10-10; 50638 bytes on 2026-10-14 after the phone filter summary fix" },
  "assets/js/calendar.js": { ceiling: 8800, reason: "script, 7966 bytes measured 2026-10-10" },
  // 2026-10-15: tilePicker adopts tiles shipped in the page, share row controls wired from markup (CLS fixes). assets/js/common.js limit 34900 to 35400. PENDING PERSON APPROVAL.
  // 2026-10-15: G.dropPreTiles removes build-time tiles when data fails common.js 35400 to 35700. PENDING PERSON APPROVAL.
  "assets/js/common.js": { ceiling: 36400, reason: "script, 25681 bytes measured 2026-10-10" },
  // Raised from 58100 to 59300 on 2026-10-12 for ticket diet-1 (Where group files on the Programs page). 59217 bytes measured.
  "data/entries-map.json": { ceiling: 667300, reason: "data file for the Map page, 606587 bytes measured 2026-10-15 (PENDING PERSON APPROVAL)" },
  // 2026-10-17 (after #44) hospitals, Davis and Yolo jobs, Boys and Girls Clubs and YMCA (+30 cards, 2,680 programs; PENDING PERSON APPROVAL) data/geo-overrides.json limit 19700 (four San Francisco city strings).
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,700 programs) data/geo-overrides.json limit 19700 to 19800 (one South suburban Cook County string). PENDING PERSON APPROVAL.
  "data/geo-overrides.json": { ceiling: 19800, reason: "hand fixes for the Map page geocoder (tools/geo), 17704 bytes measured 2026-10-15" },
  "data/map.json": { ceiling: 163300, reason: "data file, the Map page city points, 148390 bytes measured 2026-10-15" },
  "assets/js/map.js": { ceiling: 42200, reason: "script, 27559 bytes measured 2026-10-15; 35987 bytes after the review fixes; 42185 bytes on 2026-10-20 with the start view for the Ignition page (Kentaro's instruction 2026-10-20), rounded up to 100" },
  "assets/js/map-gl.js": { ceiling: 19300, reason: "street map module (MapLibre style, dots, taps), loaded by map.js only with WebGL 2; 17465 bytes measured 2026-10-16 (PENDING PERSON APPROVAL)" },
  "assets/vendor/pmtiles.js": { ceiling: 20600, reason: "PMTiles 4.5.0 reader (dist/pmtiles.js, source map line removed), 20194 bytes measured 2026-10-16; a new version needs a new row" },
  "assets/vendor/maplibre/maplibre-gl.mjs": { ceiling: 602000, reason: "MapLibre GL JS 6.11.2 main module, 590188 bytes measured 2026-10-16; a new version needs a new row" },
  "assets/vendor/maplibre/maplibre-gl-shared.mjs": { ceiling: 526200, reason: "MapLibre GL JS 6.11.2 shared module, 515877 bytes measured 2026-10-16; a new version needs a new row" },
  "assets/vendor/maplibre/maplibre-gl-worker.mjs": { ceiling: 19500, reason: "MapLibre GL JS 6.11.2 worker module, 19086 bytes measured 2026-10-16; a new version needs a new row" },
  "assets/vendor/maplibre/maplibre-gl.css": { ceiling: 85000, reason: "MapLibre GL JS 6.11.2 stylesheet, 83310 bytes measured 2026-10-16; a new version needs a new row" },
  "assets/img/us-states.svg": { ceiling: 61500, reason: "image, the Map page basemap (tools/geo/make_basemap.mjs keeps it under 58000), 55841 bytes measured 2026-10-15" },
  // 2026-10-17: the Copy buttons moved to playbook.js, which now runs on es/playbook.html too. es.js ceiling 1000 to 700.
  "assets/js/es.js": { ceiling: 2213, reason: "script, Spanish labels for the pages in es/ only (ADR 0008), 575 bytes measured 2026-10-17; 2026-10-30: + the Ignition season line (Kentaro's ask), 2113 bytes measured" },
  "assets/js/es-playbook.js": { ceiling: 9300, reason: "script, Spanish words for the Playbook tools on es/playbook.html only (ADR 0008), 8569 bytes measured 2026-10-17" },
  // 2026-10-20: the map above the cards on the Programs page, Kentaro's instruction 2026-10-20 (make the map prominent on Find): find.js 75500 to 76100 (76054 bytes), and the new find-map.js (6052 bytes), loaded only when the map comes near the screen.
  "assets/js/find.js": { ceiling: 76100, reason: "script, 52771 bytes measured 2026-10-10" },
  // 2026-10-20 (PR 73): the map shows as it draws and follows its box's size; find-map.js 6100 to 6300 (6277 bytes), Kentaro's instruction 2026-10-20.
  // 2026-10-20 (PR 74): up to three tries when the server answers the first tile request whole just after publishing (seen live); find-map.js 6300 to 6700 (6692 bytes), Kentaro's instruction 2026-10-20.
  "assets/js/find-map.js": { ceiling: 6700, reason: "the Programs page map (dots for the list, the place view, a tap keeps one city), loaded by find.js only when the map comes near the screen; 6052 bytes measured 2026-10-20, Kentaro's instruction 2026-10-20" },
  // 2026-10-16: keep my list without an account (docs/adr/0008): download, send to a parent, keep link, backup file, ask-before-adding panel. find.js 67400 to 75500 (74710 bytes). PENDING PERSON APPROVAL.
  "assets/js/handout.js": { ceiling: 600, reason: "script, 274 bytes measured 2026-10-10; 517 bytes on 2026-10-14 with the one page handout and table plan print buttons" },
  // 2026-10-12: home picker flow. home.js grew by about 8.8 KB (place search box, chip, step markers); ceiling raised from 10800 to 18600, measured 18585 bytes.
  "assets/js/home.js": { ceiling: 18700, reason: "script, 18605 bytes measured 2026-10-12 (home picker flow, plus the 1 day label)" },
  "assets/js/insights.js": { ceiling: 6100, reason: "script, 5471 bytes measured 2026-10-10" },
  "assets/js/interview.js": { ceiling: 20400, reason: "script, 18422 bytes measured 2026-10-10" },
  "assets/js/jobs.js": { ceiling: 24400, reason: "script, 22099 bytes measured 2026-10-10" },
  "assets/js/languages.js": { ceiling: 4000, reason: "script, 3579 bytes measured 2026-10-10" },
  "assets/js/leaders.js": { ceiling: 8100, reason: "script, 7361 bytes measured 2026-10-10" },
  // 2026-10-19: Add to calendar, issue #10 (PENDING PERSON APPROVAL). lib.js 56000 to 57800 (the calendar code on top of PR 36; 57742 bytes).
  "assets/js/lib.js": { ceiling: 57800, reason: "script, 50207 bytes measured 2026-10-10" },
  // 2026-10-14: parents permit table stacks on phones (ARIA roles and column labels) parents.js 3900 to 4200. PENDING PERSON APPROVAL.
  // 2026-10-14: parents opens on ?state= or the saved Programs place and keeps state= in the address parents.js 4200 to 5500. PENDING PERSON APPROVAL.
  "assets/js/parents.js": { ceiling: 5500, reason: "script, 3529 bytes measured 2026-10-10" },
  // Raised for ticket p8-paycheck-other: the Another state picker and its wage and federal tax lines. 12055 bytes measured 2026-10-12.
  // Raised again for the live status line on Another state (a state pick, and the failed wage load). 12208 bytes measured 2026-10-12.
  "assets/js/paycheck.js": { ceiling: 12500, reason: "raised 2026-10-13 for ticket ux9-other-state-search (place box); script, 12208 bytes measured 2026-10-12 (Another state picker and its live status line, p8-paycheck-other)" },
  // Raised for ticket p8-permit-lite-print: the printable checklist and next step on the shorter state answers. 31519 bytes measured 2026-10-12.
  // 2026-10-15: G.dropPreTiles call on the error path permit.js 31950 to 32000. PENDING PERSON APPROVAL.
  "assets/js/permit.js": { ceiling: 32000, reason: "script, 31830 bytes measured 2026-10-13 (ux9-permit-flow: state search box on the shorter-state list; was 31519 on 2026-10-12, p8-permit-lite-print)" },
  "assets/js/playbook.js": { ceiling: 19200, reason: "script, 17385 bytes measured 2026-10-10" },
  "assets/js/ready.js": { ceiling: 12400, reason: "script, 10954 bytes measured 2026-10-10; 12374 bytes on 2026-10-14 with Santa Ana Unified and Newport-Mesa Unified permit steps" },
  "assets/js/resume.js": { ceiling: 9600, reason: "script, 8687 bytes measured 2026-10-10" },
  "assets/js/safety.js": { ceiling: 9700, reason: "script, 8781 bytes measured 2026-10-10" },
  "assets/js/share.js": { ceiling: 1900, reason: "script, 1681 bytes measured 2026-10-10" },
  "assets/js/states.js": { ceiling: 2600, reason: "script, 2290 bytes measured 2026-10-10" },
  // Raised for ticket p9-younger-1: the permit-only states in the picker and their permit card. 16622 bytes measured 2026-10-12.
  // 2026-10-14: younger.html carries the picked state into Programs links, counts and the not-stated note (persona r9) younger.js 17900 to 20200, then 20300 (the plain buttons keep the state when the count file fails), then 20900 (the grid stacks on phones: roles and state labels). PENDING PERSON APPROVAL.
  "assets/js/younger.js": { ceiling: 21200, reason: "raised 2026-10-13 for ticket ux9-other-state-search (place box); script, 17599 bytes measured 2026-10-12 (permit-only states and card, p9-younger-1; plain note when the grid does not cover the state, p8-younger-state)" },
  "assets/img/favicon.svg": { ceiling: 500, reason: "image, 409 bytes measured 2026-10-10" },
  "assets/img/og.jpg": { ceiling: 90200, reason: "image, 81997 bytes measured 2026-10-10" },
  "assets/img/splat-orange.webp": { ceiling: 26000, reason: "image, 23622 bytes measured 2026-10-30 (real Ignition splatter art)" },
  "assets/img/splat-yellow.webp": { ceiling: 26000, reason: "image, 23628 bytes measured 2026-10-30 (real Ignition splatter art)" },
  "assets/img/swoosh.svg": { ceiling: 500, reason: "image, 449 bytes measured 2026-10-10" },
  "assets/qr/atlanta.svg": { ceiling: 2400, reason: "QR image, 2135 bytes measured 2026-10-10" },
  "assets/qr/chicago.svg": { ceiling: 2400, reason: "QR image, 2116 bytes measured 2026-10-10" },
  "assets/qr/home.svg": { ceiling: 2000, reason: "QR image, 1728 bytes measured 2026-10-10" },
  "assets/qr/ignition.svg": { ceiling: 2400, reason: "QR image for ignition.html, 2112 bytes measured 2026-10-22" },
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
