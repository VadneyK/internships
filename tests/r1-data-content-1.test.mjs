import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SENATE = JSON.parse(fs.readFileSync(new URL("../data/programs/us-senate-youth-program.json", import.meta.url), "utf8"));
const ENTRY = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8")).find((e) => e.id === "us-senate-youth-program");

test("Senate Youth card is closed (its 2027 deadline has passed) and does not say 'today'", () => {
  for (const card of [SENATE, ENTRY]) {
    assert.equal(card.status, "closed-expect-reopen");
    assert.equal(card.deadline_iso, "2026-10-07");
    assert.ok(!/\btoday\b/i.test(card.deadline_text), "deadline_text must not say today");
  }
});
