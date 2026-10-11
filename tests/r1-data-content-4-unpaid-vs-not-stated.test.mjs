import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r1-data-content-4. A card whose pay_detail says pay is not stated, mentioned or listed
// must not say paid_type "unpaid". Use "not-stated" instead. Cost-only wording such as
// "Cost not stated" is not a pay claim and passes.

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

// Cards that may keep "unpaid" even though their pay_detail names a missing pay fact.
// Each entry needs a reason. Keep this list empty unless the page says so.
const ALLOW = {
  "key-club-high-school": "The word pay is a verb here (members pay dues). The card says only that the dues amount is not listed.",
};

// Returns true when one sentence claims pay is missing (not stated, not mentioned, not listed).
function sentenceSaysPayNotStated(sentence) {
  // A semicolon ends the clause, so "No pay; cost not stated" is a no-pay claim plus a cost note, not a pay gap.
  return /\bpay\b[^;.]*\b(stated|mentioned|listed)\b/i.test(sentence);
}

// Returns the sentences in pay_detail that say pay is missing, unless the text also says the role is
// volunteer, not a job, or not a wage. An empty array means the detail is fine for paid_type "unpaid".
function unpaidConflicts(detail) {
  if (typeof detail !== "string") return [];
  if (/volunteer|not a job|not a wage/i.test(detail)) return [];
  return detail.split(/(?<=\.)\s+/).filter(sentenceSaysPayNotStated);
}

test("checker: 'Pay is not stated' on an unpaid card is a conflict", () => {
  assert.deepEqual(unpaidConflicts("Pay is not stated."), ["Pay is not stated."]);
});

test("checker: 'No cost or pay stated' on an unpaid card is a conflict", () => {
  assert.equal(unpaidConflicts("No cost or pay stated").length, 1);
});

test("checker: cost-only wording is not a pay claim and passes", () => {
  assert.deepEqual(unpaidConflicts("Cost not stated."), []);
  assert.deepEqual(unpaidConflicts("No pay; cost not stated"), []);
  assert.deepEqual(unpaidConflicts("Free to join. No pay or cost is listed for volunteers."), []);
});

test("checker: volunteer, not a job, and not a wage wording is allowed", () => {
  assert.deepEqual(unpaidConflicts("Volunteer role. Pay is not stated."), []);
  assert.deepEqual(unpaidConflicts("This is not a job. Pay is not mentioned."), []);
  assert.deepEqual(unpaidConflicts("Not a wage. Pay not listed."), []);
});

test("checker: a pay fact that is stated is not a conflict", () => {
  assert.deepEqual(unpaidConflicts("You do not get paid. Cost is not stated."), []);
});

test("no card with paid_type unpaid says pay is not stated, mentioned or listed", () => {
  const offenders = [];
  for (const card of ENTRIES) {
    if (card.paid_type !== "unpaid") continue;
    if (Object.prototype.hasOwnProperty.call(ALLOW, card.id)) continue;
    const hits = unpaidConflicts(card.pay_detail);
    if (hits.length) offenders.push(`${card.id}: ${hits.join(" | ")}`);
  }
  assert.deepEqual(
    offenders,
    [],
    "Set paid_type to \"not-stated\" for these cards, or fix pay_detail:\n" + offenders.join("\n")
  );
});

test("the seven cards from this ticket now say not-stated", () => {
  const ids = [
    "chicago-history-museum-metro-history-day",
    "cincinnati-uc-health-career-journeys",
    "elgin-teen-life-police-and-library",
    "la-county-fire-explorer-program",
    "long-beach-junior-lifeguards-cadet-program",
    "rfu-virtual-mentor-program",
    "gwinnett-da-junior-district-attorney-mentorship",
  ];
  for (const id of ids) {
    const entry = ENTRIES.find((e) => e.id === id);
    assert.ok(entry, id + " entry exists");
    assert.equal(entry.paid_type, "not-stated", id);
  }
});

test("ymca camp campbell keeps unpaid-credit, because its page names school credit as the reward", () => {
  const entry = ENTRIES.find((e) => e.id === "ymca-silicon-valley-camp-campbell-cabin-leader");
  assert.ok(entry, "entry exists");
  assert.equal(entry.paid_type, "unpaid-credit");
  assert.match(entry.pay_detail, /Service-Learning credit/);
});
