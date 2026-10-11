import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));

const CASES = {
  "blacksburg-vsgc-blast-virginia-tech-session": { opens_iso: "2026-12-01", deadline_iso: "2027-02-01" },
  "ncssm-inspire-stem-research": { opens_iso: "2027-01-06" },
};

test("BLAST and INSPIRE are opens-soon with the day the page states", () => {
  const entries = read("../data/entries.json");
  for (const [id, want] of Object.entries(CASES)) {
    const file = read(`../data/programs/${id}.json`);
    const entry = entries.find((e) => e.id === id);
    assert.ok(entry, `${id} missing from entries.json`);
    for (const card of [file, entry]) {
      assert.equal(card.status, "opens-soon", `${id} status`);
      assert.equal(card.opens_iso, want.opens_iso, `${id} opens_iso`);
    }
    if (want.deadline_iso) {
      assert.equal(file.deadline_iso, want.deadline_iso, `${id} deadline_iso`);
      assert.equal(file.deadline_confidence, "confirmed-2026-27", `${id} deadline_confidence`);
    }
  }
});
