// r3-tests-4: ratchet. paid_type must agree with pay_detail, and the ages named in
// who_can_apply must agree with min_age. The allow lists below record today's known
// mismatches. A new mismatch fails the test, and so does an entry that is fixed
// (remove it from the list). Do not add to a list to make a new card pass: fix the card.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "data", "programs");
const cards = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

const PAY_WORD = /\$\d|stipend|hourly|per hour|\/hr|wage/i;
const NO_PAY_WORD = /fee|cost|no pay|unpaid/i;
const UNPAID_WORD = /unpaid|volunteer|no pay|not paid/i;
const AGE_RE = /\b(?:ages?|at least|must be)\s+(\d+)/gi;

// Rule A reason: pay_detail only says a stipend or wage is absent, unstated, or not
// the student's pay (scholarship, tuition, microgrant), so unpaid is correct.
const ALLOW_PAY = [
  "alliance-theatre-palefsky-collision-project",
  "arc-upward-bound",
  "aurora-youth-climate-action-fund",
  "boston-northeastern-young-scholars-program",
  "champaign-urbana-park-district-cit",
  "chicago-goodman-theatre-youth-arts-council",
  "ecc-upward-bound",
  "fulton-county-youth-commission",
  "georgia-deca-state-association",
  "georgia-tech-gtae-step",
  "hidden-genius-project-immersion",
  "la-metro-youth-council",
  "larpd-summer-youth-volunteer",
  "lbnl-bldap",
  "madison-uw-engineering-summer-program",
  "michigan-mrs-pre-employment-transition-services",
  "minnesota-youth-council",
  // Free program; the dollar amount is a scholarship, not pay to the student.
  "minnesota-youth-institute-mnyi",
  "nasa-genelab-for-high-schools",
  "new-brunswick-rutgers-4h-stem-ambassadors",
  "new-jersey-governors-school-engineering-technology",
  "nyc-john-jay-upward-bound",
  "nyc-rockefeller-summer-science-research-program",
  "pomona-college-academy-for-youth-success",
  "richmond-sd38-youth-train-in-trades",
  "stanford-smysp",
  "twin-cities-walker-art-center-teen-arts-council",
  // Free; the dollar amount is a later college scholarship, and the text says there is no stipend.
  "twin-cities-umn-rooted-in-stem",
  "waubonsee-upward-bound-aurora",
  "ywca-elgin-youth-leadership-scholarship",
];

// Rule B reason: the page says paid but gives no rate, so the text has no
// conflict. The word volunteer or unpaid in the text is about something else.
const ALLOW_UNPAID = [
  "boston-boys-girls-clubs-ready-to-work",
  "sf-breakthrough-sf",
  // Paid; the unpaid part is only the first 36 Foundation Studio hours, and the text says the rate is not stated.
  "boston-artists-for-humanity-teen-jobs",
  // Paid at the stated hourly rate; the text notes the first week is unpaid.
  "seattle-ymca-wages-ten-week-internship",
];

// Rule C reason: who_can_apply names a different age than min_age (for example an
// age for one role or one site). Each needs a data fix or a plain explanation.
const ALLOW_AGE = [
  // min_age is the youngest age the card allows with an adult (r3-data-content-4); the text also names the age to go alone.
  "ann-arbor-food-gatherers-volunteer",
  "ann-arbor-summer-festival-volunteer",
  "madison-childrens-museum-volunteers",
  "austin-library-youth-volunteer",
  "black-girls-code",
  "blacksburg-montgomery-county-4-h-clubs",
  "illinois-4h-youth-development",
  "la-county-junior-lifeguard-program",
  "lafayette-food-finders-food-bank-volunteer",
  "new-york-state-4h-youth-development",
  "orange-county-oc-parks-volunteer",
  "pasadena-humane-teen-volunteers-15-and-up",
  "pg-parks-summer-youth-volunteers",
  "santa-barbara-zoo-seasonal-jobs",
  "ymca-orange-county-volunteer",
  // Same pattern: min_age 8 is the youngest age with an adult; the text also names 13 to go alone.
  "madison-dane-county-humane-society-youth-volunteer",
  // The page lists activity ideas by age from 5 up and a youth policy for 16 and 17. min_age 12 is where the teen activities start; the text names 16 for new home building.
  "austin-habitat-youth-volunteering",
];

function ageMentions(text) {
  const out = [];
  for (const m of String(text || "").matchAll(AGE_RE)) {
    const n = Number(m[1]);
    if (n >= 10 && n <= 19) out.push(n);
  }
  return out;
}

const ruleA = cards
  .filter((c) => c.paid_type === "unpaid" && PAY_WORD.test(c.pay_detail || "") && !NO_PAY_WORD.test(c.pay_detail || ""))
  .map((c) => ({ id: c.id, shown: `paid_type=unpaid pay_detail=${JSON.stringify(c.pay_detail)}` }));
const ruleB = cards
  .filter((c) => c.paid_type === "paid" && UNPAID_WORD.test(c.pay_detail || ""))
  .map((c) => ({ id: c.id, shown: `paid_type=paid pay_detail=${JSON.stringify(c.pay_detail)}` }));
const ruleC = cards
  .filter((c) => Number.isInteger(c.min_age) && ageMentions(c.who_can_apply).length && !ageMentions(c.who_can_apply).includes(c.min_age))
  .map((c) => ({ id: c.id, shown: `min_age=${c.min_age} who_can_apply=${JSON.stringify(c.who_can_apply)}` }));

function ratchet(name, offenders, allow) {
  test(`${name}: no new offenders`, () => {
    const set = new Set(allow);
    const fresh = offenders.filter((o) => !set.has(o.id));
    console.log(`${name}: ${offenders.length} offenders, ${allow.length} allowlisted, ${fresh.length} new`);
    assert.equal(fresh.length, 0, `new offenders:\n${fresh.map((o) => `  ${o.id}: ${o.shown}`).join("\n")}`);
  });
  test(`${name}: allow list has no fixed or unknown ids`, () => {
    assert.equal(new Set(allow).size, allow.length, "duplicate ids in allow list");
    const live = new Set(offenders.map((o) => o.id));
    const stale = allow.filter((id) => !live.has(id));
    const byId = new Map(cards.map((c) => [c.id, c]));
    assert.equal(
      stale.length,
      0,
      `remove from the allow list (fixed or gone):\n${stale
        .map((id) => `  ${id}: ${byId.has(id) ? `min_age=${byId.get(id).min_age} paid_type=${byId.get(id).paid_type} pay_detail=${JSON.stringify(byId.get(id).pay_detail)}` : "no such card"}`)
        .join("\n")}`,
    );
  });
}

ratchet("Rule A (unpaid but pay words)", ruleA, ALLOW_PAY);
ratchet("Rule B (paid but unpaid words)", ruleB, ALLOW_UNPAID);
ratchet("Rule C (who_can_apply age vs min_age)", ruleC, ALLOW_AGE);
