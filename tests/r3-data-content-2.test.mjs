import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const entries = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const byId = new Map(entries.map((e) => [e.id, e]));

// Cards whose pay_detail says pay is possible but unstated. They stay "mixed".
const ALLOWLIST = {
  "capital-area-nextgen-youth-services": "work experience is listed, whether it is paid is not stated",
  "san-bernardino-county-wioa-youth": "work experience is listed, pay is not stated",
  "ocwdb-ready-set-oc-young-adult": "work experience can be paid or unpaid, wage not stated",
  "ousd-linked-learning-work-based-learning": "rate not posted for work-based learning",
  "atlanta-parks-rec-teen-leaders": "teen leader activities are free, summer job pay is not stated",
  "champaign-county-rpc-youth-services": "pay not stated for youth, a separate page covers wages",
  "ecc-dual-credit": "mixed tuition rules, no pay statement",
  "charlottesville-pvcc-dual-enrollment": "mixed tuition rules, no pay statement",
  "boston-museum-of-science-youth-internships": "the museum pages do not state pay",
  "merced-county-office-of-education-high-school-rop": "cost, pay and credit are not stated on the page",
  "philadelphia-mural-arts-art-education": "cost and pay are not stated on the pages read",
  "pittsburgh-boys-girls-clubs-workforce-pathways": "cost and pay are not stated on the pages read",
};

// Cards flipped from mixed, stipend or unpaid-credit to unpaid this round, whose pay_detail
// does not say pay is stated. They stay mixed (pay unknown), not unpaid.
const PAY_NOT_STATED_IDS = [
  "arc-nextgen-youth-workforce",
  "black-girls-code",
  "california-partnership-academies",
  "chicago-park-district-recreation-leader-in-training",
  "indiana-dwd-workone-young-adult-services",
  "madison-wdbscw-wioa-youth",
  "sacramento-youth-center",
  "stanford-aimi-summer-research-internship",
];
for (const id of PAY_NOT_STATED_IDS) {
  ALLOWLIST[id] = ALLOWLIST[id] || "pay not stated on the page, so not labelled unpaid";
}

const DASHES = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const PAID = /paid|stipend|wage|\$\d|pays/i;
const NEGATED = /(not|n't|no) (stated|mention)[^.]*(wage|stipend|paid|pay)/i;

function sayssPaid(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .some((s) => PAID.test(s) && !NEGATED.test(s));
}

const OLD_TEXT = {
  "arc-nextgen-youth-workforce": "The page does not mention wages, stipends or work experience pay. Ask your county provider what is offered.",
  "indiana-dwd-workone-young-adult-services": "Not stated",
  "madison-wdbscw-wioa-youth": "Not stated. All WorkSmart Network services are free.",
  "sacramento-youth-center": "Not stated. Ask the center whether classes cost anything and whether job training pays.",
  "stanford-aimi-summer-research-internship": "Not stated on the page",
  "uc-scout": "Fees vary by course; the site mentions free options for CA public schools and scholarships (prices not on the home page)",
  "black-girls-code": "Prices not posted; Code Along videos are free",
  "stanford-grips": "Application fee (amount not stated; waived for financial need). Stipend not stated on the page.",
};

test("every mixed card says a role is paid, unless allowlisted", () => {
  const bad = entries
    .filter((e) => e.paid_type === "mixed" && !(e.id in ALLOWLIST) && !sayssPaid(e.pay_detail))
    .map((e) => e.id + ": " + e.pay_detail);
  assert.deepEqual(bad, []);
});

test("each allowlist id exists, is still mixed, and states no pay amount", () => {
  // These cards say pay is possible but unstated (or, for ecc-dual-credit, only talk about tuition).
  // If a card gains a real pay fact, give it a paid or stipend label and drop it from the list.
  for (const [id, reason] of Object.entries(ALLOWLIST)) {
    const e = byId.get(id);
    assert.ok(e, id + " no longer exists");
    assert.ok(reason.length > 0, id + " needs a reason");
    assert.equal(e.paid_type, "mixed", id + " is no longer mixed, remove it from the allowlist");
    assert.ok(!/\$\d/.test(e.pay_detail), id + " now states an amount, relabel it and remove it from the allowlist");
  }
});

test("the eight relabelled cards have new pay text", () => {
  for (const [id, old] of Object.entries(OLD_TEXT)) {
    const e = byId.get(id);
    assert.ok(e, id + " missing");
    assert.notEqual(e.pay_detail, old, id + " still has the old pay_detail");
    assert.ok(!DASHES.test(e.pay_detail), id + " has a dash character");
  }
  assert.equal(byId.get("uc-scout").paid_type, "fee-based");
  assert.equal(byId.get("stanford-grips").paid_type, "fee-based");
});

test("cards whose pay is not stated are mixed, never unpaid", () => {
  for (const id of PAY_NOT_STATED_IDS) {
    const e = byId.get(id);
    assert.ok(e, id + " missing");
    assert.equal(e.paid_type, "mixed", id + " must not be labelled unpaid when pay is not stated");
  }
});

// Cards whose pay is not stated on the page. They use paid_type "not-stated", which the pay filter
// leaves out of "Paid or stipend", so an unknown role is never shown as paid.
const NOT_STATED_IDS = [
  "atlanta-public-schools-work-based-learning",
  "aurora-better-employment-outcomes-initiative",
  "chicago-adler-planetarium-astro-ambassadors",
  "chicago-adler-planetarium-far-horizons-teens",
  "chicago-lincoln-park-zoo-conservation-ambassadors-board",
  "chicago-mikva-cps-student-advisory-council",
  "chicago-mikva-safety-and-justice-council",
  "chicago-mikva-student-election-judges",
  "chicago-mikva-teen-health-council",
  "naperville-mayors-chief-of-staff-internship",
  "nyc-brooklyn-borough-president-youth-advisory-council",
  "nyc-brooklyn-maimonides-science-scholars",
  "nyc-staten-island-historic-richmond-town-high-school-apprenticeship",
  "nyc-staten-island-wagner-college-high-school-internship",
  "santa-ana-city-student-intern",
  "the-trade-collective-evanston",
];

test("cards whose pay is not stated have paid_type not-stated", () => {
  for (const id of NOT_STATED_IDS) {
    const e = byId.get(id);
    assert.ok(e, id + " missing");
    assert.equal(e.paid_type, "not-stated", id + " must be not-stated when pay is not stated");
  }
});
