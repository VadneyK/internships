import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r3-data-content-5. Hired park and city jobs whose pay line only said the rate was
// missing now start with "Paid job." The rest of the pay line is unchanged. Naperville is
// skipped on purpose: its official pages do not say the district hires teens.

const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const ENTRIES = read("../data/entries.json");
const DETAIL = read("../data/entries-detail.json");

const PREFIXED = [
  "champaign-park-district-summer-jobs",
  "evanston-mayors-summer-youth-employment",
  "fox-valley-park-district-seasonal-jobs",
  "gwinnett-parks-lifeguard-jobs",
  "nova-parks-waterpark-jobs",
  "oak-park-park-district-seasonal-jobs",
  "oakland-parks-rec-youth-jobs",
];

const byId = (id) => ENTRIES.find((e) => e.id === id);

for (const id of PREFIXED) {
  test(`${id} says Paid job before the existing pay line`, () => {
    const e = byId(id);
    assert.ok(e, `missing entry ${id}`);
    assert.equal(e.paid_type, "paid");
    assert.match(e.pay_detail, /^Paid job\. \S/);
    assert.doesNotMatch(e.pay_detail, /[\u2013\u2014]/);
  });
}

test("naperville is not prefixed because its pages do not say it hires teens", () => {
  const e = byId("naperville-park-district-seasonal-jobs");
  assert.ok(e, "missing naperville entry");
  assert.doesNotMatch(e.pay_detail, /^Paid job\./);
});

test("the prefixed pay lines match the program files after the prefix", () => {
  for (const id of PREFIXED) {
    const file = read(`../data/programs/${id}.json`);
    assert.equal(byId(id).pay_detail, file.pay_detail);
    assert.equal(file.pay_detail.startsWith("Paid job. "), true);
  }
});
