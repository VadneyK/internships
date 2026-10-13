// First-load data inventory: every data/ file a page fetches before it settles is listed here, with a byte ceiling.
// Adding a fetch to a page, or dropping one, fails this test until the table is updated and reviewed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SMALL = "a small page file or two, no card file";

// page: { paths, ceiling (bytes on disk, all listed paths summed), reason (why that ceiling) }
export const TABLE = {
  "index.html": { paths: ["data/entries-home.json"], ceiling: 920000, reason: "Home needs the ranked Home file for the picker cards, and nothing bigger" },
  // 2026-10-12: +77 Plains state cards (2,291 programs): lite file is 2,172,802 bytes, ceiling 2160000 to 2180000; the stats file is 681,806 bytes, ceiling 680000 to 685000.
  // 2026-10-13: +50 city cards (2,348 programs): lite 2,222,946 bytes, ceiling 2180000 to 2223100; stats 697,681 bytes, ceiling 685000 to 697700.
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. find.html ceiling 2223100 to 2277600.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. find.html limit 2277600 to 2341900.
  "find.html": { paths: ["data/entries-lite.json"], ceiling: 2341900, reason: "Find filters every program, so it needs the whole lite file" },
  "calendar.html": { paths: ["data/calendar.json", "data/entries-cal.json"], ceiling: 150000, reason: "Calendar draws deadline cards from the small calendar file (only the programs it lists) plus its own small file" },
  "younger.html": { paths: ["data/entries-core.json", "data/younger.json"], ceiling: 1100000, reason: "Ages 12 to 14 reads the core file and its own small file; headroom up to the card file size" },
  // Raised from 130000 to 145000 on 2026-10-12: the employer list grew to 147 entries (about 136 KB, one entry per line, about 30 KB gzipped).
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. jobs.html ceiling 145000 to 172100.
  // 2026-10-13: four employer caveats (2,409 programs, 188 employers). jobs.html limit 172100 to 172500.
  "jobs.html": { paths: ["data/employers.json"], ceiling: 172500, reason: "Jobs lists employers from one small file; the state hours rules load only after an age of 14 to 17 and a state are picked" },
  "interview.html": { paths: ["data/interview.json"], ceiling: 60000, reason: "Tips file only; the state rules load the first time the hours checker is used" },
  "permit.html": { paths: ["data/permits.json"], ceiling: 100000, reason: "Work permit page reads only the state rules file" },
  "states.html": { paths: ["data/permits.json"], ceiling: 100000, reason: "State rules page reads only the state rules file" },
  // 2026-10-13: +61 city cards and 41 employers (2,409 programs). PENDING PERSON APPROVAL, as above. insights.html ceiling 697700 to 716100.
  // 2026-10-13: +70 statewide cards for ten thin states (2,479 programs). PENDING PERSON APPROVAL, as above. insights.html limit 716100 to 736500.
  "insights.html": { paths: ["data/entries-stats.json"], ceiling: 736500, reason: "Numbers page counts every program, so it needs the stats projection (about 528 KB), the one page over the 200000 default" },
  "languages.html": { paths: ["data/languages.json"], ceiling: 200000, reason: SMALL },
  "parents.html": { paths: ["data/parents.json"], ceiling: 200000, reason: SMALL },
  "paycheck.html": { paths: ["data/money.json"], ceiling: 200000, reason: SMALL },
  "handout.html": { paths: [], ceiling: 200000, reason: "No data needed" },
  "ready.html": { paths: ["data/transit.json"], ceiling: 200000, reason: SMALL },
  "safety.html": { paths: ["data/safety.json", "data/permits.json"], ceiling: 200000, reason: "Safe at work reads its own facts file plus the state cards in permits.json for the other states' agency numbers; both small" },
  "404.html": { paths: [], ceiling: 200000, reason: "No data needed" },
  "about.html": { paths: [], ceiling: 200000, reason: "No data needed" },
  "contribute.html": { paths: [], ceiling: 200000, reason: "No data needed" },
  "leaders.html": { paths: [], ceiling: 200000, reason: "No data needed" },
  "playbook.html": { paths: [], ceiling: 200000, reason: "No data needed" },
  "resume.html": { paths: [], ceiling: 200000, reason: "No data needed" },
  "rules.html": { paths: [], ceiling: 200000, reason: "No data needed" },
  "share.html": { paths: [], ceiling: 200000, reason: "No data needed" },
};

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

test("every table entry has a reason, a ceiling and a path list", () => {
  for (const [page, e] of Object.entries(TABLE)) {
    assert.ok(typeof e.reason === "string" && e.reason.trim().length > 0, page + " needs a reason string");
    assert.ok(Number.isInteger(e.ceiling) && e.ceiling > 0, page + " needs a numeric ceiling");
    assert.ok(Array.isArray(e.paths), page + " needs a paths list");
    for (const p of e.paths) assert.ok(fs.existsSync(path.join(ROOT, p)), page + " lists a missing file " + p);
  }
});

test("every built page is in the table and every table page is built", () => {
  assert.deepEqual(Object.keys(TABLE).sort(), pages);
});

for (const page of pages) {
  test(page + " first-load data matches the table and its budget", async () => {
    const entry = TABLE[page];
    assert.ok(entry, page + " is not in the table");
    const seen = [];
    const { window } = await loadPage(page, { fetchLog: seen, lazy: true });
    const got = [...new Set(seen.map((r) => new URL(r.url).pathname.replace(/^\//, "")).filter((p) => p.startsWith("data/")))].sort();
    window.close();
    const want = [...entry.paths].sort();
    const extra = got.filter((p) => !want.includes(p));
    const gone = want.filter((p) => !got.includes(p));
    assert.deepEqual(extra, [], page + " requests data not in its list (add it with a reason, or remove the fetch): " + extra.join(", "));
    assert.deepEqual(gone, [], page + " lists data it no longer requests: " + gone.join(", "));
    const bytes = entry.paths.reduce((n, p) => n + fs.statSync(path.join(ROOT, p)).size, 0);
    assert.ok(bytes <= entry.ceiling, page + " first-load data is " + bytes + " bytes, over its ceiling of " + entry.ceiling + " (" + entry.reason + ")");
  });
}
