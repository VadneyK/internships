// Child process for r1-tests-1-timezones.test.mjs. Not a *.test.mjs file, so node --test skips it.
// Prints JSON for fixed date cases. The parent sets TZ and compares output across zones.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const lib = require("../assets/js/lib.js");

const out = {};
const DAYS = ["2026-03-08", "2026-11-01"];

out.roundTrip = DAYS.map((s) => lib.toISO(lib.parseISO(s)));
out.addDays = {};
for (const s of DAYS) {
  out.addDays[s] = [-1, 0, 1, 2, 7, 30].map((n) => lib.addDays(s, n));
}
out.addDays["2026-03-07"] = [1, 2].map((n) => lib.addDays("2026-03-07", n));
out.addDays["2026-10-31"] = [1, 2].map((n) => lib.addDays("2026-10-31", n));

// daysUntil from local noon and local 23:59 on the clock change days.
out.daysUntil = {};
for (const s of DAYS) {
  const [y, m, d] = s.split("-").map(Number);
  const target = lib.parseISO(lib.addDays(s, 3));
  const noon = new Date(y, m - 1, d, 12, 0, 0);
  const late = new Date(y, m - 1, d, 23, 59, 0);
  out.daysUntil[s] = [lib.daysUntil(target, noon), lib.daysUntil(target, late)];
  out.daysUntil[s + " same day"] = [lib.daysUntil(lib.parseISO(s), noon), lib.daysUntil(lib.parseISO(s), late)];
}

// effStatus: a deadline equal to today stays open, at noon and at 23:59.
out.effStatus = {};
for (const s of DAYS) {
  const [y, m, d] = s.split("-").map(Number);
  const e = { status: "open-now", deadline_iso: s };
  out.effStatus[s] = [
    lib.effStatus(e, new Date(y, m - 1, d, 0, 0, 0)),
    lib.effStatus(e, new Date(y, m - 1, d, 12, 0, 0)),
    lib.effStatus(e, new Date(y, m - 1, d, 23, 59, 0)),
  ];
  out.effStatus[s + " day after"] = lib.effStatus(e, new Date(y, m - 1, d + 1, 0, 0, 0));
}

console.log(JSON.stringify(out));
