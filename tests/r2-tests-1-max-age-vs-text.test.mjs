import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-tests-1. A card's max_age must agree with the ages its who_can_apply names.
// r3-tests-4-field-agreement checks min_age. This file checks the top of the range.
// A null or too-high max_age makes the age filter show a 17 year old a card whose page
// says it stops at 13 or 15.
//
// Rule: for each card whose who_can_apply says "ages X to Y", "aged X to Y",
// "between X and Y" or "X through Y", max_age must equal the highest Y. Tolerance:
// when the text also says "under 18" style wording, max_age may be one below Y or equal to Y
// (TOLERANCE below). A card that cannot follow the rule goes in ALLOW with a one-line reason.
// Every ALLOW entry must still be needed; a stale entry fails. Fix the data, or add a
// reviewed reason. Never add an entry just to make a new card pass.

const TOLERANCE = 1; // used only when the text has "under N" wording (see below)

// id -> one-line reason the card is legitimately different. Reviewed by the lead; empty on
// first run. The test prints the unreviewed cases so they can be fixed or allow-listed.
const ALLOW = {
  "omaha-public-library-youth-volunteer": "No upper age limit: the library takes volunteers age 11 and older. The 11 to 18 range is only the group that needs a parent or guardian to approve.",
  "columbus-metro-parks-volunteer": "No upper age limit: most assignments are 16 and up, and the 11 to 15 range is only the Inniswood Metro Gardens junior option.",
  "wisconsin-wing-civil-air-patrol-cadets": "The two sources disagree (12 to 19 on the wing site, 12 to 18 on the national page). max_age 18 is the national page and the text names both.",
  "youth-uprising-summer-jobs": "max_age 21 is the summer jobs list for ages 14 to 21. The 13 to 24 range is the whole organization, not the summer jobs.",
  "berkeley-humane-teen-volunteer": "No upper age limit: the range in the text is the group that needs an adult with them, and older teens volunteer on their own.",
  "bloomington-animal-shelter-volunteers": "No upper age limit: the range in the text is the group that needs an adult with them, and older teens volunteer on their own.",
  "lafayette-food-finders-food-bank-volunteer": "No upper age limit: the range in the text is the group that needs an adult with them, and older teens volunteer on their own.",
  "lansing-capital-area-humane-society-volunteer": "No upper age limit: the range in the text is the group that needs an adult with them, and older teens volunteer on their own.",
  "san-diego-food-bank-youth-volunteer": "No upper age limit: the range in the text is the group that needs an adult with them, and older teens volunteer on their own.",
  "santa-ana-zoo-volunteer": "No upper age limit: the range in the text is the group that needs an adult with them, and older teens volunteer on their own.",
  "alameda-free-library-teen-advisory-group": "The page states no age or grade. The 12 to 17 range comes from other teen roles on the same page, so max_age stays null.",
  "ann-arbor-aadl-teen-volunteer": "Open to anyone 14 or older. The 14 to 17 range is only the group that needs a signed permission slip.",
  "austin-habitat-youth-volunteering": "max_age 17 is right: the 12 to 15 range is the group kept off active building sites, and ages 16 and 17 may help build.",
  "blacksburg-montgomery-county-4-h-clubs": "Most clubs are ages 9 to 18. Only the home school Senior club goes to 19.",
  "boston-futurebos-youth-jobs": "max_age 24 includes the leader jobs for ages 19 to 24. Regular youth jobs are 14 to 18.",
  "brookhaven-police-cadet-program": "The page says both 18 and 19 as the top age, so max_age 19 is the more open reading and the text tells the teen to confirm.",
  "chp-explorer-post-east-sacramento": "The CHP lists 15 to 20 and the post page snippet says 15 to 21. max_age 20 is the official CHP figure and the text names both.",
  "columbus-humane-teen-volunteers": "max_age 17 is right: ages 12 to 15 join as junior volunteers with an adult, and 16 and 17 can volunteer on their own.",
  "elk-grove-youth-commission": "The page lists no ages. The 13 to 18 range came from a search snippet the text says is unconfirmed, so max_age stays null.",
  "foodbank-central-eastern-nc-youth-volunteers": "The card is for ages 12 and up. The 5 to 11 range is a separate Kids Day session.",
  "habitat-east-bay-silicon-valley-volunteer": "Open to age 16 and up. The 16 to 18 range is only the group that brings a minor waiver.",
  "irvine-library-teen-volunteers": "Open to ages 14 and over. The 14 to 17 range covers only two of the volunteer roles.",
  "lansing-dewitt-library-summer-volunteen": "The page gives no upper age limit. The 14 to 15 range is not an upper limit.",
  "lansing-peckham-youth-work-based-learning": "Open to youth and young adults with no stated top age. The 12 to 17 range is only the Embers group.",
  "madison-childrens-museum-volunteers": "Ages 14 and up volunteer on their own. The 8 to 13 range is the group that comes with a caregiver.",
  "michigan-cranbrook-institute-of-science-volunteer": "Open to people 16 or older. The form has a box for ages 16 to 17, which is not an upper limit.",
  "nc-symphony-youth-concerto-competition": "The card is for the Junior Division, ages 13 to 18. The Young Artist Division for 18 to 23 is a separate group.",
  "nyc-brooklyn-bric-teen-media-curatorial-fellowships": "The page lists no exact ages. The 15 to 19 range is an estimate from the grade wording, so max_age stays null.",
  "nyc-brooklyn-groundswell-studio-programs": "Most classes are ages 14 to 19. Only the Advanced Portfolio class goes to 24.",
  "nyc-mount-sinai-morningside-jump-teen-volunteer": "The card covers more than JuMP. The 15 to 17 range is only the JuMP program, and Unit Support is open to high school students.",
  "nyc-northwell-manhattan-campus-junior-volunteer": "Volunteers must be at least 16. The 16 to 17 range names the junior volunteer group and sets no upper age.",
  "oakland-public-library-teen-advisory-board": "max_age 18 covers 18 year olds still in high school, which the text says.",
  "oakland-public-library-teen-volunteer": "max_age 18 covers 18 year olds still in high school, which the text says.",
  "red-cross-babysitting-training": "The page names 11 to 16 for the in-person class and 11 and older for the online course, so no single top age fits.",
  "sacramento-food-bank-volunteer": "Open to age 10 and up. The 10 to 15 and 16 to 17 ranges are the two supervision tiers.",
  "san-jose-works": "max_age 18 is the paid work experience. The 16 to 29 range is only the job help.",
  "seattle-parks-yesl-pre-employment-training": "max_age 18 is the Pre-Employment Training. The 15 to 21 range is the paid internships it leads to.",
  "tacoma-public-schools-jobs-253-summer-credential-programs": "Open to high school students. The 16 to 18 range is only the drone course age rule.",
  "twin-cities-open-arms-of-minnesota-youth-volunteers": "Ages 16 and up volunteer on their own. The 12 to 15 range is the group that needs a trained adult with them.",
  "wilmette-library-teen-volunteers": "The program is set by grades 9 to 12, not by age. The 11 to 13 range is a separate helper group.",
  "ymca-san-francisco-workforce-development": "The page says ages 14 to 24 and older, so there is no firm top age and max_age stays null.",
  // Added 2026-10-11 for ticket p7-regions-1 (cards for 11 new states).
  "arapahoe-libraries-teen-volunteer": "The page lists no exact ages. The 12 to 18 range is the library teen section, so max_age stays null.",
  "florida-jacksonville-mayors-youth-at-work-partnership": "max_age 21 is the main group (ages 16 to 21 in school). The 16 to 24 range is only the out of school group.",
  "groundwork-denver-green-teams": "max_age 17 is the Green Team age. The 18 to 21 range is only the returning youth leaders.",
  "las-vegas-natural-history-museum-volunteer": "Open to age 16 and up. The 14 to 15 range is the group that volunteers with a parent or guardian.",
  "las-vegas-springs-preserve-volunteer": "Open to anyone 14 or older. The 14 to 17 range is only the group that turns in a parental permission agreement.",
  "lexington-public-library-volunteer": "Open to anyone 14 or older. The 14 to 17 range is only the group that needs permission from a parent or guardian.",
  "louisville-summerworks": "max_age 19 is what the program page says. The 16 to 21 range is from an older news post from the same group.",
  "portland-multnomah-county-library-teen-council": "max_age 18 is right for middle and high school students. The 9 to 12 range is a separate Tween Council.",
  "salem-oregon-humane-youth-volunteer": "max_age 17 is what the Apply Now button says. The 12 to 15 range is the group that volunteers with a parent or guardian.",
  // Added 2026-10-12 for the new state cards.
  "nyc-central-park-conservancy-teen-volunteer-days": "The page says ages 13 to 18 in one place and 13 to 17 in another, and the text says to ask. max_age 17 is the stricter reading.",
  "atlanta-community-food-bank-teen-volunteers": "Open to age 8 and up with no upper age. The 8 to 11 and 12 to 17 ranges are the adult-to-youth ratios for groups.",
  "los-angeles-dcfs-independent-living-program": "The 16 to 18 range is the ages when the youth was in foster care, not an age limit to join.",
  "missouri-4h-youth-development": "The card is about the whole 4-H program. The 5 to 18 range is only the SPIN clubs.",
  "tucson-village-farm-summer-camp-teen-counselors": "The 5 to 18 range is the campers. The page gives no age rule for teen counselors, so max_age stays null.",
  // "austin-humane-society-teen-volunteer": "Tiered roles, 14 to 15 and 16 to 17; max_age 17 is the top tier.",
};

// ---- Pure logic ----
// Returns every [lo, hi] pair the text names with a range phrase.
export function ageRanges(text) {
  const s = String(text || "");
  const out = [];
  const num = "(\\d{1,2})";
  const patterns = [
    new RegExp(`\\bages?\\s+${num}\\s*(?:to|through|thru|-)\\s*${num}\\b`, "gi"),
    new RegExp(`\\baged\\s+${num}\\s*(?:to|through|thru|-)\\s*${num}\\b`, "gi"),
    new RegExp(`\\bbetween\\s+(?:the\\s+ages\\s+of\\s+)?${num}\\s+and\\s+${num}\\b`, "gi"),
    new RegExp(`(?<!grades?\\s)\\b${num}\\s+through\\s+${num}\\b`, "gi"),
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(s))) {
      const lo = Number(m[1]);
      const hi = Number(m[2]);
      // keep only plausible youth ages so "between 2 and 4 pm" or "10 through 12 hours" do not count
      if (lo >= 5 && hi <= 30 && lo < hi && !/^\s*(?:am|pm|hours?|days?|weeks?|months?|minutes?|grade)/i.test(s.slice(re.lastIndex, re.lastIndex + 8))) {
        out.push([lo, hi]);
      }
    }
  }
  return out;
}

// "under 18" or "younger than 18" wording means the real last age is 17 even though the text names 18.
export function hasUnderWording(text) {
  return /\b(?:under|younger than)\s+\d{1,2}\b/i.test(String(text || ""));
}

// Returns a problem string, or null when the card agrees with its text.
export function checkCard(card) {
  const ranges = ageRanges(card.who_can_apply);
  if (!ranges.length) return null;
  const top = Math.max(...ranges.map((r) => r[1]));
  const m = card.max_age;
  if (m === top) return null;
  if (hasUnderWording(card.who_can_apply) && Number.isInteger(m) && Math.abs(m - top) <= TOLERANCE) return null;
  return `max_age=${m === null || m === undefined ? "null" : m} but who_can_apply names up to ${top} (ranges ${ranges.map((r) => r.join("-")).join(", ")}): ${JSON.stringify(card.who_can_apply)}`;
}

// ---- Unit tests on the logic and a seeded bad fixture ----
test("ageRanges reads the four phrasings and ignores times", () => {
  assert.deepEqual(ageRanges("Open to ages 15 to 21."), [[15, 21]]);
  assert.deepEqual(ageRanges("Youth aged 16 to 19 may join."), [[16, 19]]);
  assert.deepEqual(ageRanges("Teens between 14 and 18 can apply."), [[14, 18]]);
  assert.deepEqual(ageRanges("Students 13 through 17 are welcome."), [[13, 17]]);
  assert.deepEqual(ageRanges("Open between 2 and 4 pm."), []);
  assert.deepEqual(ageRanges("Students in grades 7 through 12."), []);
  assert.deepEqual(ageRanges("No ages named."), []);
});

test("checkCard catches a seeded bad fixture and passes good ones", () => {
  const bad = { id: "fixture-bad", who_can_apply: "Kids ages 11 to 13 can help.", max_age: null };
  assert.match(checkCard(bad), /max_age=null but who_can_apply names up to 13/);
  assert.match(checkCard({ ...bad, max_age: 17 }), /up to 13/);
  assert.equal(checkCard({ ...bad, max_age: 13 }), null);
  // tiered text: the highest Y wins
  const tiered = { who_can_apply: "Ages 14 to 15 and ages 16 to 17.", max_age: 17 };
  assert.equal(checkCard(tiered), null);
  // under-18 wording gets the stated tolerance of 1
  const under = { who_can_apply: "Open to ages 14 to 18, and must be under 18 at start.", max_age: 17 };
  assert.equal(checkCard(under), null);
  assert.notEqual(checkCard({ ...under, who_can_apply: "Open to ages 14 to 18." }), null);
});

// ---- Load the repo data (read only) ----
const progDir = new URL("../data/programs/", import.meta.url);
const CARDS = fs
  .readdirSync(progDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(fs.readFileSync(new URL(f, progDir), "utf8")));
const byId = new Map(CARDS.map((c) => [c.id, c]));

const problems = CARDS.map((c) => ({ id: c.id, problem: checkCard(c) })).filter((p) => p.problem);
const unreviewed = problems.filter((p) => !(p.id in ALLOW));

test("every card's max_age agrees with the ages its who_can_apply names (or is allow-listed)", () => {
  if (unreviewed.length) {
    console.log(`r2-tests-1 max_age: ${unreviewed.length} unreviewed card(s). Fix the data or add to ALLOW with a reason:`);
    for (const p of unreviewed) console.log(`  ${p.id}: ${p.problem}`);
  }
  assert.equal(
    unreviewed.length,
    0,
    `Cards where max_age disagrees with who_can_apply:\n` + unreviewed.map((p) => `  ${p.id}: ${p.problem}`).join("\n"),
  );
});

test("every ALLOW entry has a reason, names a real card and is still needed", () => {
  const stale = [];
  for (const [id, reason] of Object.entries(ALLOW)) {
    assert.ok(typeof reason === "string" && reason.trim().length > 10, `ALLOW entry ${id} needs a one-line reason`);
    assert.ok(byId.has(id), `ALLOW entry ${id} names no card`);
    if (!checkCard(byId.get(id))) stale.push(id);
  }
  assert.deepEqual(stale, [], `Stale ALLOW entries (the card now agrees, remove them): ${stale.join(", ")}`);
});

test("a null max_age with a stated range is always reported or allow-listed with a reason", () => {
  const nullWithRange = CARDS.filter((c) => (c.max_age === null || c.max_age === undefined) && ageRanges(c.who_can_apply).length);
  const bad = nullWithRange.filter((c) => !(typeof ALLOW[c.id] === "string" && ALLOW[c.id].trim()));
  assert.deepEqual(
    bad.map((c) => c.id),
    [],
    `Null max_age but the text names a range, add a max_age or an ALLOW reason: ${bad.map((c) => c.id).join(", ")}`,
  );
});
