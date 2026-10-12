// Regional chains on the Jobs page: Fareway, Publix, Wegmans and Culver's.
// A chain that only runs stores in some states must list those states, so a teen in another state does not see it as local.
// States come from an official page of the chain (where_url + where_quote). Culver's pages we could read do not name states, so it stays US.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const employers = JSON.parse(fs.readFileSync(path.join(ROOT, "data/employers.json"), "utf8")).employers;
const byId = (id) => employers.find((e) => e.id === id);

const VALID = new Set(("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY").split(" "));
const IDS = ["fareway", "publix", "wegmans", "culvers"];

// Same rule as inState() in assets/js/jobs.js, for a US state pick.
const shownFor = (e, st) => (e.where && e.where.length ? e.where : ["US"]).some((w) => w === "US" || w === st);

test("the four chains exist", () => {
  for (const id of IDS) assert.ok(byId(id), id + " is missing");
});

test("each chain is still US, or has a list of valid state codes with an official source and quote", () => {
  for (const id of IDS) {
    const e = byId(id);
    assert.ok(Array.isArray(e.where) && e.where.length > 0, id + " has no where");
    const isUS = e.where.length === 1 && e.where[0] === "US";
    if (isUS) continue;
    assert.equal(new Set(e.where).size, e.where.length, id + " repeats a state");
    for (const code of e.where) assert.ok(VALID.has(code), id + " has an invalid code " + code);
    assert.ok(!e.where.includes("US"), id + " mixes US with states");
    assert.match(e.where_url || "", /^https:\/\/[^\s]+$/, id + " needs an https where_url");
    assert.ok(typeof e.where_quote === "string" && e.where_quote.trim().length > 10, id + " needs a where_quote");
  }
});

test("source quotes use the state names that match the codes", () => {
  const NAMES = { IA: "Iowa", IL: "Illinois", KS: "Kansas", MN: "Minnesota", MO: "Missouri", NE: "Nebraska", SD: "South Dakota",
    AL: "Alabama", FL: "Florida", GA: "Georgia", KY: "Kentucky", NC: "North Carolina", SC: "South Carolina", TN: "Tennessee", VA: "Virginia",
    CT: "Connecticut", DC: "DC", DE: "Delaware", MD: "Maryland", MA: "Massachusetts", NJ: "New Jersey", NY: "New York", PA: "Pennsylvania" };
  for (const id of ["fareway", "publix", "wegmans"]) {
    const e = byId(id);
    for (const code of e.where) assert.ok(e.where_quote.includes(NAMES[code]), id + " quote does not name " + NAMES[code]);
  }
});

test("Fareway, Publix and Wegmans are narrowed, and Culver's stays US", () => {
  assert.deepEqual(byId("fareway").where, ["IA", "IL", "KS", "MN", "MO", "NE", "SD"]);
  assert.deepEqual(byId("publix").where, ["AL", "FL", "GA", "KY", "NC", "SC", "TN", "VA"]);
  assert.deepEqual(byId("wegmans").where, ["CT", "DC", "DE", "MD", "MA", "NJ", "NY", "NC", "PA", "VA"]);
  assert.deepEqual(byId("culvers").where, ["US"]);
});

test("Publix is not shown for a Nebraska pick, and Fareway is not shown for Florida", () => {
  assert.equal(shownFor(byId("publix"), "NE"), false);
  assert.equal(shownFor(byId("publix"), "FL"), true);
  assert.equal(shownFor(byId("fareway"), "FL"), false);
  assert.equal(shownFor(byId("fareway"), "NE"), true);
  assert.equal(shownFor(byId("wegmans"), "NE"), false);
  assert.equal(shownFor(byId("wegmans"), "NY"), true);
  assert.equal(shownFor(byId("culvers"), "NE"), true);
});
