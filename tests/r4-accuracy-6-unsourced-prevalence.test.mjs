// Ticket r2-accuracy-6: unsourced prevalence claims ("most districts", "often faster", "most no replies")
// were removed from Get ready and the Playbook. Each page exists as a src template and a built root file,
// so both are checked. The three old phrases must not return, and the replacement sentences must be there.
// Run with: node --test tests/r4-accuracy-6-unsourced-prevalence.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const READY_FILES = ["src/ready.html", "ready.html"];
const PLAYBOOK_FILES = ["src/playbook.html", "playbook.html"];

const OLD_READY_DISTRICTS = "in most districts the steps are the same";
const OLD_READY_COUNTY = "The county office where you were born is often faster.";
const OLD_PLAYBOOK_REPLY = "means a busy person, not a no";

const NEW_READY_DISTRICTS =
  "Steps and waiting time differ by district. Some districts take a day and some take up to a week. The usual steps: get hired, fill out the form with your employer and a parent, hand it in.";
const NEW_READY_COUNTY =
  "You can also ask the county office where you were born how long it takes.";
const NEW_PLAYBOOK_REPLY = "No reply can mean the person is busy. Move on to the next name.";

// The built pages hold curly quotes as HTML entities, so the old "no reply" wording is checked in both forms.
const OLD_PLAYBOOK_QUOTED = [
  "Most &ldquo;no reply&rdquo; means a busy person, not a no.",
  "Most “no reply” means a busy person, not a no.",
];

for (const file of READY_FILES) {
  test(`r4-accuracy-6: ${file} has no unsourced district or county claims`, () => {
    const html = read(file);
    assert.ok(!html.includes(OLD_READY_DISTRICTS), `${file} still says "most districts" (no source)`);
    assert.ok(!html.includes(OLD_READY_COUNTY), `${file} still says the county office is "often faster" (no source)`);
    assert.ok(html.includes(NEW_READY_DISTRICTS), `${file} is missing the district timing sentence`);
    assert.ok(html.includes(NEW_READY_COUNTY), `${file} is missing the county office sentence`);
  });
}

for (const file of PLAYBOOK_FILES) {
  test(`r4-accuracy-6: ${file} has no unsourced "no reply" prevalence claim`, () => {
    const html = read(file);
    assert.ok(!html.includes(OLD_PLAYBOOK_REPLY), `${file} still says most "no reply" means a busy person`);
    for (const old of OLD_PLAYBOOK_QUOTED) {
      assert.ok(!html.includes(old), `${file} still has the old "no reply" sentence: ${old}`);
    }
    assert.ok(html.includes(NEW_PLAYBOOK_REPLY), `${file} is missing the new "no reply" sentence`);
  });
}
