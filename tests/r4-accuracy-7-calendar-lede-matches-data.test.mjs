// Ticket r4-accuracy-7 (calendar): the lede claim about summer programs must match data/entries.json.
// Only summer programs with a deadline_iso count. More than half must have a month from 01 to 04.
// Run with: node --test tests/r4-accuracy-7-calendar-lede-matches-data.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const ENTRIES = JSON.parse(read("data/entries.json"));
const LEDE = "Of the summer programs here with a dated deadline, most close between January and April, so the time to get ready is now.";

test("calendar lede: the claim about dated summer programs matches data/entries.json", () => {
  const dated = ENTRIES.filter((e) => e.season === "summer" && e.deadline_iso);
  assert.ok(dated.length > 0, "there are dated summer programs");
  const early = dated.filter((e) => ["01", "02", "03", "04"].includes(String(e.deadline_iso).slice(5, 7)));
  assert.ok(early.length * 2 > dated.length, `most dated summer deadlines fall in January to April (${early.length} of ${dated.length})`);
});

test("calendar lede: src and built page both say the scoped claim", () => {
  assert.ok(read("src/calendar.html").includes(LEDE), "src/calendar.html has the lede");
  assert.ok(read("calendar.html").includes(LEDE), "calendar.html has the lede");
  assert.doesNotMatch(read("src/calendar.html"), /Most summer programs take applications/);
  assert.doesNotMatch(read("calendar.html"), /Most summer programs take applications/);
});
