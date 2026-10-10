// Work-permit rule for unpaid volunteer cards.
// A volunteer card that says the work permit is needed must say so in its text
// (who_can_apply, how_to_apply or notes), so the permit answer on the card
// matches the permit finder.
// Run with: node --test tests/r2-data-content-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ENTRIES = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const PHRASES = ["working papers", "work permit", "employment certificate"];
const byId = (id) => ENTRIES.find((e) => e.id === id);

function mentionsPermitRule(e) {
  const text = [e.who_can_apply, e.how_to_apply, e.notes]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  return PHRASES.some((p) => text.includes(p));
}

const UNPAID_PERMIT_VOLUNTEERS = ENTRIES.filter(
  (e) => e.type === "volunteer" && e.paid_type === "unpaid" && e.needs_work_permit === true
);

test("every unpaid volunteer card that needs a work permit says so in its text", () => {
  const missing = UNPAID_PERMIT_VOLUNTEERS.filter((e) => !mentionsPermitRule(e)).map((e) => e.id);
  assert.deepEqual(missing, [], "these cards set needs_work_permit true but do not mention working papers or a work permit");
});

test("qpl-teen-volunteer is a matching card and passes the rule", () => {
  const q = byId("qpl-teen-volunteer");
  assert.ok(q, "qpl-teen-volunteer is in entries.json");
  assert.ok(UNPAID_PERMIT_VOLUNTEERS.includes(q), "qpl-teen-volunteer is an unpaid volunteer card with needs_work_permit true");
  assert.ok(mentionsPermitRule(q), "qpl-teen-volunteer cites the working papers rule in its text");
});

test("the NYU Langone Manhattan volunteer card uses null, not true, and notes that the pages are silent", () => {
  const n = byId("nyc-nyu-langone-manhattan-summer-volunteer");
  assert.ok(n, "NYU Langone card is in entries.json");
  assert.equal(n.paid_type, "unpaid");
  assert.equal(n.needs_work_permit, null, "the pages do not mention working papers, so the answer is unknown (null), not false");
  assert.ok(
    /do not mention working papers/i.test(n.notes || ""),
    "notes say the pages do not mention working papers"
  );
  assert.ok(!UNPAID_PERMIT_VOLUNTEERS.includes(n), "a null answer keeps this card out of the rule above");
});
