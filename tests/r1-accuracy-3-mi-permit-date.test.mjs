// Michigan permit card: the start date and the announcement date must not conflict.
// Source: michigan.gov/leo news release dated Oct 1, 2026, which says "Beginning Oct. 2, 2026".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PERMITS = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const mi = PERMITS.states.mi;
const DATE = /[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4}/g;

test("Michigan issuer names one start date, Oct 2, 2026", () => {
  const m = mi.issuer.match(/^From (\w+\.? \d{1,2}, \d{4})/);
  assert.ok(m, "issuer should begin with 'From <start date>'");
  assert.equal(m[1].replace(".", ""), "Oct 2, 2026");
  assert.deepEqual([...new Set(mi.issuer.match(DATE) || [])], ["Oct 2, 2026"], "issuer has only the start date");
});

test("Michigan link text never gives a permit-system or start date that conflicts with the issuer", () => {
  const start = "Oct 2, 2026";
  mi.links.forEach((l) => {
    const dates = l.t.match(DATE) || [];
    if (/permit|system|start|begin|effective/i.test(l.t)) {
      dates.forEach((d) => assert.equal(d, start, "link '" + l.t + "' gives " + d + " for the permit system"));
    }
  });
});

test("Michigan card: the Oct 1 announcement is labelled as a news release", () => {
  const news = mi.links.filter((l) => /Oct 1, 2026/.test(l.t));
  assert.equal(news.length, 1, "one link carries the Oct 1 announcement");
  assert.match(news[0].t, /^News release, Oct 1, 2026$/);
  assert.match(news[0].u, /\/news\/2026\/10\/01\//);
});

test("Michigan card: no date in the card conflicts with Oct 2, 2026 for the portal start", () => {
  const all = [mi.issuer, mi.read, mi.timing, mi.renew, ...mi.links.map((l) => l.t)].join(" ");
  const dates = new Set(all.match(DATE) || []);
  // Oct 1 is allowed only as the news release date (checked above). No other Oct date may appear.
  for (const d of dates) assert.ok(["Oct 1, 2026", "Oct 2, 2026", "Oct 9, 2026"].includes(d), "unexpected date " + d);
});
