import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Two closed-expect-reopen cards kept deadline_iso 2026-10-09 after that date passed.
// Closed cards carry deadline_iso null and keep the date in deadline_text. No 2027 date is invented.

const IDS = ["nyc-dycd-work-learn-grow", "pittsburgh-warhol-youth-arts-council"];

for (const ID of IDS) {
  const card = JSON.parse(fs.readFileSync(new URL(`../data/programs/${ID}.json`, import.meta.url), "utf8"));

  test(`${ID}: closed card has no stale deadline_iso`, () => {
    assert.equal(card.status, "closed-expect-reopen");
    assert.equal(card.deadline_iso, null);
  });

  test(`${ID}: deadline_text still records the passed October 9, 2026 date`, () => {
    assert.match(card.deadline_text, /October 9, 2026/);
  });
}
