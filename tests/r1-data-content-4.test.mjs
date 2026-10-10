import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Eight cards whose how_to_apply names a specific place to apply that is not the card's main url host.
const IDS = [
  "ann-arbor-trinity-health-teen-volunteer",
  "habitat-greater-sacramento-volunteers",
  "riverside-public-library-volunteer-14-plus",
  "slac-regional-science-bowl-high-school",
  "capital-area-nextgen-youth-services",
  "atlanta-parks-rec-teen-leaders",
  "san-diego-city-pool-guard-recreation-aide",
  "seattle-parks-lifeguard-jobs",
];

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

function program(id) {
  return JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
}

// Hosts named in how_to_apply, such as "riversideca.cervistech.com" or "atlantaga.gov/iparcs".
function hostsNamed(text) {
  return [...new Set(text.toLowerCase().match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/g) || [])];
}

for (const id of IDS) {
  test(`${id}: apply_url is null or an https link on a host named in how_to_apply`, () => {
    const card = program(id);
    if (card.apply_url === null) return;
    assert.equal(typeof card.apply_url, "string");
    const u = new URL(card.apply_url);
    assert.equal(u.protocol, "https:", "apply_url must be https");
    const hosts = hostsNamed(card.how_to_apply);
    assert.ok(
      hosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h)),
      `apply_url host ${u.hostname} must match a host named in how_to_apply`
    );
  });

  test(`${id}: generated entries.json carries the same apply_url as the program file`, () => {
    const card = program(id);
    const entry = ENTRIES.find((e) => e.id === id);
    assert.ok(entry, "entry exists in entries.json");
    assert.equal(entry.apply_url, card.apply_url);
  });
}
