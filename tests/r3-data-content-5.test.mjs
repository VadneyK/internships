import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Two cards whose how_to_apply names a sign-up site, where apply_url was null before this round.
const IDS = ["seattle-youth-employment-program", "irvine-library-teen-volunteers"];

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

function program(id) {
  return JSON.parse(fs.readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));
}

// Hosts named in how_to_apply, such as "youthconnect.powerappsportals.us" or "www.volgistics.com".
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

test("seattle-youth-employment-program: apply_url is the youthconnect sign-up site named in how_to_apply", () => {
  const card = program("seattle-youth-employment-program");
  assert.equal(card.apply_url, "https://youthconnect.powerappsportals.us/");
  assert.ok(card.how_to_apply.includes("youthconnect.powerappsportals.us"));
});

test("irvine-library-teen-volunteers: apply_url is the Teen Volunteer Application link on the host named in how_to_apply", () => {
  const card = program("irvine-library-teen-volunteers");
  assert.equal(card.apply_url, "https://www.volgistics.com/appform/337674493");
  assert.ok(card.how_to_apply.includes("www.volgistics.com/appform/337674493"));
});
