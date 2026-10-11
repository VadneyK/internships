// Three Pittsburgh cards were all named "Teen Volunteer Program". Each name must now say the org,
// and each id must stay the same so saved lists and links keep working.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const EXPECTED = {
  "pittsburgh-kamin-science-center-teen-volunteers": {
    name: "Teen Volunteer Program at Kamin Science Center",
    org: "Kamin Science Center (formerly Carnegie Science Center)",
  },
  "pittsburgh-national-aviary-teen-volunteers": {
    name: "Teen Volunteer Program at National Aviary",
    org: "National Aviary",
  },
  "pittsburgh-upmc-childrens-teen-volunteer": {
    name: "Teen Volunteer Program at UPMC Children's Hospital of Pittsburgh",
    org: "UPMC Children's Hospital of Pittsburgh",
  },
};

function load(id) {
  return JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
}

for (const [id, want] of Object.entries(EXPECTED)) {
  test(`${id} name says its org and keeps its id`, () => {
    const card = load(id);
    assert.equal(card.id, id);
    assert.equal(card.name, want.name);
    assert.equal(card.org, want.org, "the short name must use the org field text");
    assert.ok(card.name.includes(card.org.replace(/\s*\(.*\)\s*$/, "").trim()), "name must carry the org name");
  });
}

test("the three Pittsburgh teen volunteer names are distinct", () => {
  const names = Object.keys(EXPECTED).map((id) => load(id).name);
  assert.equal(new Set(names).size, names.length);
});

test("entries.json carries the new names for the three ids", () => {
  const entries = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
  for (const [id, want] of Object.entries(EXPECTED)) {
    const row = entries.find((e) => e.id === id);
    assert.ok(row, `${id} is in entries.json`);
    assert.equal(row.name, want.name);
  }
});
