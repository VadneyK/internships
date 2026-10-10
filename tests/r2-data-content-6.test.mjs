import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-data-content-6.
// A card's min_age and max_age must match the single "ages A to B" range written in its
// who_can_apply. A wrong age silently hides a program from the age filter.
// Cards are checked only when who_can_apply has exactly one age range and exactly one age word.

const ENTRIES = JSON.parse(
  fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"),
);

const RANGE = /\bages? (\d{1,2}) to (\d{1,2})\b/gi;
const AGE_WORD = /\b(ages?|aged|at least|over|under|older|age of)\b/gi;

// Cards that look like the strict rule but differ on purpose. Each entry must still exist
// and still fail the strict rule, so the list shrinks when the data is fixed.
const ALLOWLIST = {
  "chp-explorer-post-east-sacramento":
    "Sources conflict: the CHP lists ages 15 to 20 while the East Sacramento post says 15 to 21; stored 15 to 20.",
  "boston-futurebos-youth-jobs":
    "Youth jobs are ages 14 to 18 and leader jobs are ages 19 to 24; stored as one range, 14 to 24.",
  "wisconsin-wing-civil-air-patrol-cadets":
    "Sources conflict: the Wisconsin Wing site labels the cadet program ages 12 to 19 while the national CAP page says 12 to 18; stored 12 to 18.",
  "oakland-public-library-teen-volunteer":
    "Who can apply reads 'ages 13 to 17, or 18 and still in high school'; stored 13 to 18.",
  "brookhaven-police-cadet-program":
    "Sources conflict: the page lists ages 14 to 18 in one place and 14 to 19 in another; stored 14 to 19 so no one who may qualify is hidden.",
  "wilmette-library-teen-volunteers":
    "The main program is for grades 9 to 12 (ages left empty). The 11 to 13 range is a separate library helper role, so it is not stored as the age range.",
};

const strictMatch = (card) => {
  const text = card.who_can_apply || "";
  const ranges = [...text.matchAll(RANGE)];
  const words = [...text.matchAll(AGE_WORD)];
  if (ranges.length !== 1 || words.length !== 1) return null;
  return { a: Number(ranges[0][1]), b: Number(ranges[0][2]) };
};

const strictlyChecked = ENTRIES.filter((c) => strictMatch(c) !== null);
const strictlyCheckedIds = new Set(strictlyChecked.map((c) => c.id));

test("at least 100 cards are checked by the strict age rule", () => {
  assert.ok(
    strictlyChecked.length >= 100,
    `only ${strictlyChecked.length} cards matched the strict rule`,
  );
});

test("every card with one age range and one age word has matching min_age and max_age", () => {
  const mismatches = [];
  for (const card of strictlyChecked) {
    if (Object.hasOwn(ALLOWLIST, card.id)) continue;
    const { a, b } = strictMatch(card);
    if (card.min_age !== a || card.max_age !== b) {
      mismatches.push(
        `${card.id}: who_can_apply says ${a} to ${b}, stored ${card.min_age} to ${card.max_age}`,
      );
    }
  }
  assert.deepEqual(mismatches, []);
});

for (const [id, reason] of Object.entries(ALLOWLIST)) {
  test(`allowlisted ${id} still exists and still fails the strict rule`, () => {
    assert.ok(reason && reason.length > 0, "allowlist entry needs a reason");
    const card = ENTRIES.find((c) => c.id === id);
    assert.ok(card, `${id} is not in data/entries.json; remove it from the allowlist`);
    const strict = strictMatch(card);
    assert.ok(
      strict !== null,
      `${id} no longer has exactly one age range and one age word; remove it from the allowlist`,
    );
    assert.ok(
      card.min_age !== strict.a || card.max_age !== strict.b,
      `${id} now matches who_can_apply; remove it from the allowlist`,
    );
    assert.ok(strictlyCheckedIds.has(id));
  });
}
