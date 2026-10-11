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

// Cards whose how_to_apply names a sign-up site. Cards left null had no link on their own page
// (or only a single job listing on a host the text does not name).
const SET = {
  "worksource-dekalb-wioa-youth-services": "https://atlworks.org/",
  "santa-clarita-public-library-teen-advisory-board": "https://santaclaritavolunteers.com/",
  "nc-summer-ventures-science-math": "https://www.cfnc.org/",
  "long-beach-parks-recreation-program-leader": "https://www.governmentjobs.com/careers/longbeach",
};
const NULL = [
  "gwinnett-volunteer-internship-program",
  "gwinnett-parks-lifeguard-jobs",
  "georgia-worksource-youth-wioa",
  "seattle-parks-lifeguard-jobs",
];
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const program = (id) => JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
const hostsNamed = (t) => [...new Set(t.toLowerCase().match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/g) || [])];

for (const [id, url] of Object.entries(SET)) {
  test(`${id}: apply_url is https on a host named in how_to_apply`, () => {
    const card = program(id);
    assert.equal(card.apply_url, url);
    const u = new URL(card.apply_url);
    assert.equal(u.protocol, "https:");
    assert.ok(hostsNamed(card.how_to_apply).some((h) => u.hostname === h || u.hostname.endsWith("." + h)));
    assert.equal(ENTRIES.find((e) => e.id === id).apply_url, url);
  });
}
for (const id of NULL) {
  test(`${id}: apply_url stays null`, () => {
    assert.equal(program(id).apply_url, null);
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
