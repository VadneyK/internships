import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Second batch of open-now cards whose how_to_apply named a link or button. A card has a direct apply_url only when the official page shows one.
const LINKED = {
  "philadelphia-pafa-youth-council": "pafa-museum.coursestorm.com",
  "cosumnes-csd-teen-committees": "www.cosumnescsd.gov",
  "rfu-virtual-mentor-program": "forms.gle",
  "salem-oregon-humane-youth-volunteer": "oregonhumane.volunteerportal.org",
  "ymca-silicon-valley-camp-campbell-cabin-leader": "www.ymcasv.org",
  "illinois-4h-food-advocacy-ambassadors": "form.jotform.com",
  "boston-mit-beaver-works-summer-institute": "mit-bwsi.formstack.com",
};
const NULL_IDS = ["new-brunswick-rutgers-upward-bound-math-science"];

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const program = (id) => JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
const hostsNamed = (t) => [...new Set(t.toLowerCase().match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/g) || [])];

// UCSF ImmunoExplore card: the page still says "2026 camper applications are open" under a
// "Summer Camp 2025" title with no dates, so the card must say the page is out of date and
// must not claim a confirmed deadline.
const ID = "sf-ucsf-immunoexplore";
const card = program(ID);

test(`${ID}: status is unconfirmed, not closed-expect-reopen`, () => {
  assert.equal(card.status, "unconfirmed");
});

test(`${ID}: no deadline or confirmed date is invented`, () => {
  assert.equal(card.deadline_iso, null);
  assert.equal(card.deadline_confidence, "unknown");
  assert.equal(card.opens_iso, null);
  assert.equal(card.grades, null);
  assert.equal(card.min_age, null);
  assert.equal(card.max_age, null);
});

test(`${ID}: deadline_text says the page is out of date and to email before applying`, () => {
  assert.match(card.deadline_text, /out of date/);
  assert.match(card.deadline_text, /Summer Camp 2025/);
  assert.match(card.deadline_text, /email the program through the Contact Us link/);
});

test(`${ID}: how_to_apply tells teens to email before using the Google Form`, () => {
  assert.match(card.how_to_apply, /^Email the program first/);
  assert.match(card.how_to_apply, /Google Form/);
});

test(`${ID}: verified_on is the day the official page was read`, () => {
  assert.equal(card.verified, "fetched");
  assert.equal(card.verified_on, "2026-10-09");
});

test(`${ID}: generated entries.json matches the program file status and dates`, () => {
  const entry = ENTRIES.find((e) => e.id === ID);
  assert.ok(entry, "entry exists");
  assert.equal(entry.status, card.status);
  assert.equal(entry.deadline_confidence, card.deadline_confidence);
  assert.equal(entry.deadline_text, card.deadline_text);
  assert.equal(entry.verified_on, card.verified_on);
});

test(`${ID}: no em dash or en dash in any text field`, () => {
  const text = JSON.stringify(card);
  assert.doesNotMatch(text, /[\u2013\u2014]/);
});

for (const [id, host] of Object.entries(LINKED)) {
  test(`${id}: apply_url is an https link on ${host} and how_to_apply names that host`, () => {
    const card = program(id);
    const u = new URL(card.apply_url);
    assert.equal(u.protocol, "https:");
    assert.equal(u.hostname, host);
    assert.ok(hostsNamed(card.how_to_apply).some((h) => u.hostname === h || u.hostname.endsWith("." + h)));
    assert.equal(ENTRIES.find((e) => e.id === id).apply_url, card.apply_url);
  });
}
for (const id of NULL_IDS) {
  test(`${id}: no link on the page, so apply_url stays null and how_to_apply does not point to a missing link`, () => {
    const card = program(id);
    assert.equal(card.apply_url, null);
    assert.ok(!/link on the page/i.test(card.how_to_apply));
    assert.equal(ENTRIES.find((e) => e.id === id).apply_url, null);
  });
}
