// First-load data budget: every page may fetch only the data files on its own list, under a byte ceiling.
// Records each /data/*.json request made during load plus 400 ms, using the real page scripts in jsdom.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const size = (f) => fs.statSync(path.join(ROOT, "data", f)).size;

// Raised on 2026-10-10 for jobs (the state filter reads permits.json, 79 KB) and younger (new near-home rows).
// The Home picker also fetches up to four data/programs/<id>.json files (about 2 KB each) after a pick; those are not in this list and are budgeted in r3-a11y-perf-2-home-four-files.test.mjs.
// page -> { allowed: data files it may request, ceiling: max total bytes of the files it actually requested }
// Ceilings are the sum of the allowed files rounded up, so a swap to a bigger file fails.
// Raised on 2026-10-10 for index, find, calendar, insights and younger: the guide grew from 1,370 to 1,771 programs (about 29 percent), so the card, lite, stats and core files grew with it. The ceilings are still the new sums rounded up. No page gained a file; entries-blurb.json and expiring-dates.json are fetched by other pages only.
const PAGES = {
  // index.html, insights.html and younger.html: raised on 2026-10-11 for ticket p7-regions-1 (267 new cards for 11 states): 715000 to 830000 (home file is 817,474 bytes), 530000 to 615000 (stats file is 606,688), 340000 to 390000 (core file plus younger.json is 385,653).
  // Raised again on 2026-10-12 for the 178 more city cards (2,214 programs), PENDING PERSON APPROVAL: home file 889,144 bytes (ceiling 830000 to 920000), lite file 2,097,871 (2030000 to 2160000), stats file 659,043 (615000 to 680000), core file plus younger.json 417,763 (390000 to 430000).
  // 2026-10-12: +77 Plains state cards (2,291 programs): find.html lite file plus gaps.json 2,177,634 bytes (ceiling 2160000 to 2180000), insights.html stats file 681,806 (680000 to 685000), younger.html core file plus younger.json 431,683 (430000 to 435000). PENDING PERSON APPROVAL, as above.
  "index.html": { allowed: ["entries-home.json"], ceiling: 920000 },
  // 2026-10-13: +50 city cards for the six new Where cities (2,348 programs). find 2180000 to 2223100 (2,222,946), insights 685000 to 697700 (697,681), younger 435000 to 442000 (441,899). PENDING PERSON APPROVAL, as above.
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. find.html ceiling 2223100 to 2277600.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. find.html limit 2277600 to 2341900.
  // 2026-10-13: re-read of 177 workshop-city cards (38 fixed). find.html limit 2341900 to 2342200.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. find.html limit 2342200 to 2377900.
  // 2026-10-13: re-read of 213 more open cards (42 fixed). find.html limit 2377900 to 2378800.
  // 2026-10-14 persona round 9: lite cards gain a derived limited flag (325 cards) for Good fit for you find.html limit 2378800 to 2383200.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) find.html limit 2383200 to 2467100.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) find.html limit 2467100 to 2468900.
  // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) find.html limit 2468900 to 2496100. PENDING PERSON APPROVAL.
  // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. find.html limit 2496100 to 2507300.
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,670 programs) find.html limit 2507300 to 2526900. PENDING PERSON APPROVAL.
  "find.html": { allowed: ["entries-lite.json", "gaps.json"], ceiling: 2526900 },
  "calendar.html": { allowed: ["calendar.json", "entries-cal.json"], ceiling: 150000 },
  // 2026-10-15: the Map page reads the map projection and the city points (754,977 bytes). PENDING PERSON APPROVAL, as above.
  // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) map.html limit 760000 to 763100. PENDING PERSON APPROVAL.
  // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. map.html limit 763100 to 766100.
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,670 programs) map.html limit 766100 to 771600. PENDING PERSON APPROVAL.
  "map.html": { allowed: ["entries-map.json", "map.json"], ceiling: 771600 },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. insights.html ceiling 697700 to 716100.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. insights.html limit 716100 to 736500.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. insights.html limit 736500 to 748900.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) insights.html limit 748900 to 776000.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) insights.html limit 776000 to 776700.
  // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) insights.html limit 776700 to 785100. PENDING PERSON APPROVAL.
  // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. insights.html limit 785100 to 788200.
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,670 programs) insights.html limit 788200 to 794100. PENDING PERSON APPROVAL.
  "insights.html": { allowed: ["entries-stats.json"], ceiling: 794100 },
  // younger.html: raised from 336000 to 340000 on 2026-10-11 (r5-younger-1: pet care card and address-safe script added 2.7 KB to younger.json)
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. younger.html ceiling 442000 to 452800.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. younger.html limit 452800 to 465400.
  // 2026-10-13: +40 city cards (Portland, Phoenix, Detroit, St. Louis, Nashville, Denver) and 20 employers (2,519 programs). PENDING PERSON APPROVAL, as above. younger.html limit 465400 to 472700.
  // 2026-10-14 gaps wave: 89 cards for Alameda, Tri-Valley, Contra Costa and Orange County (2,608 programs) younger.html limit 472700 to 488300.
  // 2026-10-14 gaps wave plus two Fremont cards read in a real browser (2,610 programs) younger.html limit 488300 to 488700.
  // 2026-10-15 persona round 10: California cells on the 12 to 14 grid give the chart's hours younger.html limit 488700 to 489000.
  // 2026-10-16 East Coast pages read in a real browser (+28 cards, 2,638 programs) younger.html limit 489000 to 494400. PENDING PERSON APPROVAL.
  // 2026-10-17 Pacific Northwest and Vancouver cards read in a real browser for issue 23, rebased on e7628a4 (2,650 programs). PENDING PERSON APPROVAL, as above. younger.html limit 494400 to 496600.
  // 2026-10-17 Midwest and Texas pages read in a real browser (+20 cards, 2,670 programs) younger.html limit 496600 to 500300. PENDING PERSON APPROVAL.
  "younger.html": { allowed: ["younger.json", "entries-core.json"], ceiling: 500300 },
  "interview.html": { allowed: ["interview.json", "permits.json"], ceiling: 95000 },
  // permit.html and states.html: raised from 82000 to 83000 on 2026-10-12 (r2-accuracy-2 and r2-accuracy-8: the 2027 wage lines and the Washington, DC wording; permits.json is 82,370 bytes)
  "permit.html": { allowed: ["permits.json"], ceiling: 83000 },
  "paycheck.html": { allowed: ["money.json"], ceiling: 15000 },
  "ready.html": { allowed: ["transit.json"], ceiling: 10000 },
  // safety.html: raised from 45000 to 125000 on 2026-10-11 (r5-safety-1: the other states' agency numbers come from permits.json, 79 KB)
  "safety.html": { allowed: ["safety.json", "permits.json"], ceiling: 125000 },
  "handout.html": { allowed: [], ceiling: 0 },
  "parents.html": { allowed: ["parents.json"], ceiling: 30000 },
  "languages.html": { allowed: ["languages.json"], ceiling: 10000 },
  // jobs.html: raised from 150000 to 190000 on 2026-10-11 (employer list 66 to 96 entries) and to 215000 the same day (120 entries: BC, California, Ohio and 17 and 18 year old jobs)
  "jobs.html": { allowed: ["employers.json", "permits.json"], ceiling: 215000 },
  "states.html": { allowed: ["permits.json"], ceiling: 83000 },
  "playbook.html": { allowed: [], ceiling: 0 },
  "resume.html": { allowed: [], ceiling: 0 },
  "leaders.html": { allowed: [], ceiling: 0 },
  "share.html": { allowed: [], ceiling: 0 },
  // pages with no data script
  "about.html": { allowed: [], ceiling: 0 },
  "rules.html": { allowed: [], ceiling: 0 },
  "contribute.html": { allowed: [], ceiling: 0 },
  "404.html": { allowed: [], ceiling: 0 },
};

async function dataRequests(file) {
  const seen = [];
  const { window } = await loadPage(file, {
    setup(w) {
      let real;
      Object.defineProperty(w, "fetch", {
        configurable: true,
        get() { return real && ((u, o) => { seen.push(new URL(String(u), w.location.href).pathname); return real(u, o); }); },
        set(v) { real = v; },
      });
    },
  });
  await new Promise((r) => setTimeout(r, 400));
  window.close();
  return [...new Set(seen)].filter((p) => /\/data\/[^/]+\.json$/.test(p)).map((p) => path.basename(p));
}

for (const [file, { allowed, ceiling }] of Object.entries(PAGES)) {
  test(file + " fetches only its allowed data files, under budget", async () => {
    const got = await dataRequests(file);
    assert.ok(!got.includes("entries.json"), file + " must not fetch the 2.7 MB data/entries.json");
    const extra = got.filter((f) => !allowed.includes(f));
    assert.deepEqual(extra, [], file + " fetched data files not on its list: " + extra.join(", "));
    const total = got.reduce((n, f) => n + size(f), 0);
    assert.ok(total <= ceiling, file + " fetched " + total + " bytes of data, ceiling " + ceiling);
    if (ceiling === 0) assert.deepEqual(got, [], file + " should request no data/*.json");
  });
}

test("every root html page is listed in PAGES", () => {
  const built = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  const missing = built.filter((f) => !(f in PAGES));
  assert.deepEqual(missing, [], "root pages missing from PAGES: " + missing.join(", "));
});

test("every listed allowed file exists on disk", () => {
  for (const [file, { allowed }] of Object.entries(PAGES)) for (const f of allowed) assert.ok(fs.existsSync(path.join(ROOT, "data", f)), file + " lists missing " + f);
});
