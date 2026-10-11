// Group 1 of the researcher-voice cleanup: the 8 program cards must not use
// "I" or "we" notes in teen-facing text, and must not use long dash characters.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const IDS = [
  "accel-middle-college",
  "alameda-county-library-teen-volunteer",
  "anderson-humane-teen-volunteers-school-service",
  "atlanta-summer-youth-employment-program",
  "aurora-better-employment-outcomes-initiative",
  "austin-humane-society-teen-volunteer",
  "austin-thinkery-volunteens",
  "baltimore-wide-angle-mediaworks-summer",
];
const VOICE = /\b(we checked|when we|we read|we could|we did not|we found|I could|I read|the page I|pages I)\b/i;
const DASH = /[\u2013\u2014]/;

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

test("entries.json has no researcher voice for the 8 group 1 ids", () => {
  const all = JSON.parse(readFileSync(join(root, "data", "entries.json"), "utf8"));
  const items = Array.isArray(all) ? all : all.entries || [];
  const hit = items.filter((e) => IDS.includes(e.id) && texts(e).some((t) => VOICE.test(t)));
  assert.deepEqual(hit.map((e) => e.id), []);
});
