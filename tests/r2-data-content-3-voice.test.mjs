// Group 3 of the researcher-voice cleanup (cards 17 to 24): the 8 program files
// must not use "I" or "we" notes in teen-facing text, and must keep the same
// dates, numbers and URLs they had before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const IDS = [
  "college-park-nasa-goddard-space-club-scholars",
  "cpl-teen-school-year-assistantships",
  "dublin-youth-advisory-committee",
  "edison-public-library-teen-advisory-board",
  "fremont-mission-valley-rop",
  "fulton-county-library-teen-volunteers",
  "georgetown-st-davids-high-school-volunteer",
  "hire-las-youth",
];
const VOICE = /\b(we checked|when we|we read|we could|we did not|we found|I could|I read|the page I|pages I)\b/i;
const DASH = /[\u2013\u2014]/;

// Facts that must survive the rewrite (taken from the original text).
const KEPT = {
  "dublin-youth-advisory-committee": ["925-556-4500", "2026-27", "2027-28"],
  "edison-public-library-teen-advisory-board": ["October 14"],
  "fulton-county-library-teen-volunteers": ["2026-10-10", "404-613-0125", "vol.services@fultoncountyga.gov"],
  "hire-las-youth": ["2024", "I-9"],
};

function texts(obj, out = []) {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => texts(v, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((v) => texts(v, out));
  return out;
}

for (const id of IDS) {
  test(`${id}: no researcher voice and no long dashes`, () => {
    const data = JSON.parse(readFileSync(join(root, "data", "programs", `${id}.json`), "utf8"));
    for (const t of texts(data)) {
      assert.doesNotMatch(t, VOICE, `voice found in ${id}: ${t}`);
      assert.doesNotMatch(t, DASH, `dash found in ${id}: ${t}`);
    }
  });
}

for (const [id, facts] of Object.entries(KEPT)) {
  test(`${id}: facts from the original text are still there`, () => {
    const data = JSON.parse(readFileSync(join(root, "data", "programs", `${id}.json`), "utf8"));
    const all = texts(data).join("\n");
    for (const f of facts) assert.ok(all.includes(f), `missing ${f} in ${id}`);
  });
}

test("entries.json has no researcher voice for the 8 group 3 ids", () => {
  const all = JSON.parse(readFileSync(join(root, "data", "entries.json"), "utf8"));
  const items = Array.isArray(all) ? all : all.entries || [];
  const hit = items.filter((e) => IDS.includes(e.id) && texts(e).some((t) => VOICE.test(t)));
  assert.deepEqual(hit.map((e) => e.id), []);
});
