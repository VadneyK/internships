import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r1-data-content-7. A card name may not say paid, stipend or wage unless paid_type is
// "paid", "stipend" or "mixed". A name like "paid tracks" on a fee-based card tells a teen the
// program pays, when it does not.

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

// Cards that may keep a pay word in the name while paid_type says otherwise. Each entry needs a reason. Keep this empty.
const ALLOW = {};

const NAME_PAY_WORD = /\bpaid\b|stipend|wage/i;
const PAY_TYPES_ALLOWED_IN_NAME = new Set(["paid", "stipend", "mixed"]);

// Returns the ids of cards whose name uses a pay word but whose paid_type does not allow it.
function nameConflicts(cards) {
  const offenders = [];
  for (const card of cards) {
    if (typeof card.name !== "string" || !NAME_PAY_WORD.test(card.name)) continue;
    if (PAY_TYPES_ALLOWED_IN_NAME.has(card.paid_type)) continue;
    offenders.push(card.id);
  }
  return offenders;
}

test("checker: 'paid' in a name on a fee-based card is a conflict", () => {
  assert.deepEqual(
    nameConflicts([{ id: "x", name: "Pre-College (paid tracks)", paid_type: "fee-based" }]),
    ["x"],
  );
});

test("checker: stipend and wage in a name on unpaid or not-stated cards are conflicts", () => {
  assert.deepEqual(
    nameConflicts([
      { id: "a", name: "Summer Stipend Program", paid_type: "unpaid" },
      { id: "b", name: "Hourly Wage Job", paid_type: "unpaid-credit" },
      { id: "c", name: "Paid Internship", paid_type: "not-stated" },
    ]),
    ["a", "b", "c"],
  );
});

test("checker: pay words are allowed when paid_type is paid, stipend or mixed", () => {
  assert.deepEqual(
    nameConflicts([
      { id: "p", name: "Paid Internship", paid_type: "paid" },
      { id: "s", name: "Summer Stipend Program", paid_type: "stipend" },
      { id: "m", name: "Paid and Unpaid Tracks", paid_type: "mixed" },
    ]),
    [],
  );
});

test("checker: a name without a pay word is never a conflict", () => {
  assert.deepEqual(
    nameConflicts([{ id: "n", name: "Library Helpers", paid_type: "fee-based" }]),
    [],
  );
});

test("no card name says paid, stipend or wage unless paid_type is paid, stipend or mixed", () => {
  const offenders = nameConflicts(ENTRIES).filter(
    (id) => !Object.prototype.hasOwnProperty.call(ALLOW, id),
  );
  assert.deepEqual(
    offenders,
    [],
    `Cards whose name says paid, stipend or wage but paid_type does not allow it: ${offenders.join(", ")}`,
  );
});

test("allowlist entries still name a card that has the conflict", () => {
  const byId = new Map(ENTRIES.map((card) => [card.id, card]));
  for (const id of Object.keys(ALLOW)) {
    const card = byId.get(id);
    assert.ok(card, `allowlisted id ${id} is not in data/entries.json`);
    assert.ok(
      nameConflicts([card]).length === 1,
      `allowlisted id ${id} no longer conflicts; remove it from ALLOW`,
    );
  }
});
