import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r3-data-content-1. The two California YMCA Youth and Government cards were merged.
const read = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const DELETED = "ymca-silicon-valley-youth-and-government";
const KEPT = "ymca-youth-and-government-ca";

for (const f of ["entries", "entries-lite", "entries-core"]) {
  test("deleted id is absent from data/" + f + ".json", () => {
    const list = read("data/" + f + ".json");
    assert.ok(!list.some((e) => e.id === DELETED));
  });
}

test("survivor covers statewide and silicon-valley with the sign-up link", () => {
  const e = read("data/entries.json").find((x) => x.id === KEPT);
  assert.ok(e, "survivor missing");
  assert.equal(e.regions[0], "statewide");
  assert.ok(e.regions.includes("silicon-valley"));
  assert.equal(e.apply_url, "https://forms.ymcasv.org/view.php?id=76792");
  assert.equal(e.paid_type, "fee-based");
});

// Separate state programs of the same YMCA model government. Each runs its own conference in its own state,
// so each is its own card. The test guards against a second California card.
const OTHER_STATES = ["illinois-ymca-youth-and-government", "indiana-ymca-youth-and-government", "ohio-ymca-youth-and-government", "seattle-ymca-youth-and-government-youth-legislature"];

test("only one California card is named Youth and Government", () => {
  const hits = read("data/entries.json").filter((e) => /youth (and|&) government/i.test(e.name) && !OTHER_STATES.includes(e.id));
  assert.equal(hits.length, 1, hits.map((e) => e.id).join(", "));
});
