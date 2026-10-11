// Ticket r2-data-content-5: job fairs and free events must not say paid_type "unpaid" unless their page
// says the roles there are unpaid. Each pay_detail says the event is free to attend and what the page says
// about jobs there. (The file name avoids r2-data-content-5.test.mjs, which already holds another ticket.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const FAIRS = [
  "sf-community-youth-center-job-fair",
  "alameda-youth-career-job-fair",
  "santa-barbara-public-library-teen-job-volunteer-fair",
  "philadelphia-pyn-youth-opportunity-fair-2026",
];
const ENTRIES = read("data/entries.json");

for (const id of FAIRS) {
  test(`${id}: not labelled unpaid, and pay_detail says free to attend`, () => {
    const prog = read(`data/programs/${id}.json`);
    assert.notEqual(prog.paid_type, "unpaid", id);
    assert.equal(prog.paid_type, "not-stated", id);
    assert.match(prog.pay_detail, /free to attend/i, id);
    assert.match(prog.pay_detail, /does not say if .* paid/, id);
  });

  test(`${id}: built entries.json matches the program file`, () => {
    const prog = read(`data/programs/${id}.json`);
    const entry = ENTRIES.find((e) => e.id === id);
    assert.ok(entry, id + " is in entries.json");
    assert.equal(entry.paid_type, prog.paid_type, id);
    assert.equal(entry.pay_detail, prog.pay_detail, id);
  });
}

test("no fair in the data is labelled unpaid while its pay_detail says pay is not stated", () => {
  const bad = ENTRIES.filter((e) => e.paid_type === "unpaid" && /job fair|youth career/i.test(e.name) && /not stated|not mentioned|not listed/i.test(e.pay_detail || ""));
  assert.deepEqual(bad.map((e) => e.id), []);
});
