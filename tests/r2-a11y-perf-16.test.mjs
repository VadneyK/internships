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

// The Home picker also fetches up to four data/programs/<id>.json files (about 2 KB each) after a pick; those are not in this list and are budgeted in r3-a11y-perf-2-home-four-files.test.mjs.
// page -> { allowed: data files it may request, ceiling: max total bytes of the files it actually requested }
// Ceilings are the sum of the allowed files rounded up, so a swap to a bigger file fails.
// Raised on 2026-10-10 for index, find, calendar, insights and younger: the guide grew from 1,370 to 1,771 programs (about 29 percent), so the card, lite, stats and core files grew with it. The ceilings are still the new sums rounded up. No page gained a file; entries-blurb.json and expiring-dates.json are fetched by other pages only.
const PAGES = {
  "index.html": { allowed: ["entries-card.json"], ceiling: 1030000 },
  "find.html": { allowed: ["entries-lite.json", "gaps.json"], ceiling: 2030000 },
  "calendar.html": { allowed: ["calendar.json", "entries-card.json"], ceiling: 1040000 },
  "insights.html": { allowed: ["entries-stats.json"], ceiling: 530000 },
  "younger.html": { allowed: ["younger.json", "entries-core.json"], ceiling: 335000 },
  "interview.html": { allowed: ["interview.json", "permits.json"], ceiling: 95000 },
  "permit.html": { allowed: ["permits.json"], ceiling: 80000 },
  "paycheck.html": { allowed: ["money.json"], ceiling: 15000 },
  "ready.html": { allowed: ["transit.json"], ceiling: 10000 },
  "safety.html": { allowed: ["safety.json"], ceiling: 45000 },
  "parents.html": { allowed: ["parents.json"], ceiling: 30000 },
  "languages.html": { allowed: ["languages.json"], ceiling: 10000 },
  "states.html": { allowed: ["permits.json"], ceiling: 80000 },
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

test("every listed allowed file exists on disk", () => {
  for (const [file, { allowed }] of Object.entries(PAGES)) for (const f of allowed) assert.ok(fs.existsSync(path.join(ROOT, "data", f)), file + " lists missing " + f);
});
