// Eight cards linked a home page even though a deeper page on the same host was read.
// Each url must now be the deeper page that tools/hygiene.py names, and that page must be in sources_fetched.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const EXPECTED = {
  "pittsburgh-job-corps-center": "https://pittsburgh.jobcorps.gov/campus-life",
  "md-job-corps-woodstock": "https://woodstock.jobcorps.gov/training-programs",
  "grafton-job-corps-center": "https://grafton.jobcorps.gov/campus-life",
  "edison-job-corps-center": "https://edison.jobcorps.gov/campus-life",
  "congressional-app-challenge": "https://www.congressionalappchallenge.us/rules/",
  "key-club-high-school": "https://www.keyclub.org/how-it-works",
  "zooniverse": "https://www.zooniverse.org/about/faq",
  "us-senate-youth-program": "https://ussenateyouth.org/selection_process_administrators",
};

function load(id) {
  return JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
}

for (const [id, url] of Object.entries(EXPECTED)) {
  test(`${id} links the deeper page it read`, () => {
    const card = load(id);
    assert.equal(card.url, url);
    assert.ok(card.sources_fetched.includes(url), "the deeper page must be in sources_fetched");
  });
}

test("apply_url is unchanged where the home page was the only apply link", () => {
  // Cards that already had a separate apply_url keep it. Cards with apply_url null stay null.
  assert.equal(load("congressional-app-challenge").apply_url, null);
  assert.equal(load("zooniverse").apply_url, null);
  assert.equal(load("us-senate-youth-program").apply_url, null);
});

test("built entries carry the new url for each card", () => {
  const entries = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
  for (const [id, url] of Object.entries(EXPECTED)) {
    const entry = entries.find((e) => e.id === id);
    assert.ok(entry, `${id} is missing from entries.json`);
    assert.equal(entry.url, url);
  }
});
