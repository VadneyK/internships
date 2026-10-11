import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ticket r3-data-content-1 (group A): cards whose pay_detail only says pay or cost is not stated
// must be "not-stated", not "mixed". The pay_detail text is kept as written.
const entries = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const byId = new Map(entries.map((e) => [e.id, e]));

const FIXED = [
  "arc-nextgen-youth-workforce",
  "california-partnership-academies",
  "caltech-summer-research-connection-pasadena-unified",
  "indiana-dwd-workone-young-adult-services",
  "merced-county-office-of-education-high-school-rop",
  "msm-grow-cells-cancer-research-summer",
  "philadelphia-mural-arts-art-education",
  "philadelphia-penn-provost-summer-mentorship-program",
];

test("r3-data-content-1: the eight group A cards are not-stated, not mixed", () => {
  for (const id of FIXED) {
    const e = byId.get(id);
    assert.ok(e, id + " missing");
    assert.equal(e.paid_type, "not-stated", id + " must be not-stated");
    assert.ok(e.pay_detail && /not stated|ask the|does not say|not mentioned/i.test(e.pay_detail), id + " pay_detail lost its wording");
  }
});

test("r3-data-content-1: none of the eight is still mixed", () => {
  const still = FIXED.filter((id) => byId.get(id).paid_type === "mixed");
  assert.deepEqual(still, []);
});
