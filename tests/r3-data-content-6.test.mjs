import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Set C: apply_url copied from the button on the official page. Cards with no single link stay null.
const LINKED = {
  "boston-mit-primes": "https://mitprimes.slideroom.com/#/permalink/program/90895/e5nHkTIJ3q",
  "college-park-umd-sparc-robotics-certificate": "https://docs.google.com/forms/d/e/1FAIpQLSfkKor9FaUJvV-EcGFHegBHHPcX5DvroMRSlt6Yc4ZHtyyKGw/viewform",
  "lansing-msu-dual-enrollment": "https://apply.dualenrollment.msu.edu/DualEnroll",
  "wake-tech-wakeworks-youth-apprenticeship-academy": "https://forms.cloud.microsoft/pages/responsepage.aspx?id=2YrMFv6EHUi5sEjndYxBqh7bclDMmEJEjlL7z93L6fFUNUJTSDNKNzBBMklaMVVMS09TSVdMT01ISC4u&route=shorturl",
  "philadelphia-villanova-pre-college-summer-academy": "https://explore.villanova.edu/apply/?sr=73ad7782-6964-4c70-b9b8-4e9991329463",
};
const NULL_IDS = ["madison-ceos-of-tomorrow-teens-internship", "phoenix-azyouthforce-paid-internships", "cook-memorial-library-teen-volunteers"];
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const program = (id) => JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));

for (const [id, url] of Object.entries(LINKED)) {
  test(`${id}: apply_url is the https link printed on the official page`, () => {
    const card = program(id);
    assert.equal(card.apply_url, url);
    assert.equal(new URL(url).protocol, "https:");
    assert.equal(ENTRIES.find((e) => e.id === id).apply_url, url);
  });
}
for (const id of NULL_IDS) {
  test(`${id}: no single application link on the page, so apply_url stays null`, () => {
    assert.equal(program(id).apply_url, null);
    assert.equal(ENTRIES.find((e) => e.id === id).apply_url, null);
  });
}
