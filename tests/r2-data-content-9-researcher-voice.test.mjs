import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Ticket r2-data-content-7, widened in the round 3 sweep.
// No program text may use the researcher voice ("we checked", "the page I read",
// "pages we read", "Not stated on the pages read", ...). The check covers every
// string field of every data/programs/*.json file, not only a few card fields.
// Use "the program page", "the program pages" or "as of <date>" instead.

const VOICE =
  /\b(we checked|we read|we did not|we found|we could|when we|I could|I read|the page I|pages I|page I|the page we|pages we|page we|pages read|page read|we looked|we saw)\b/i;

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data", "programs");
const FILES = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort();

function strings(obj, out = []) {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => strings(v, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((v) => strings(v, out));
  return out;
}

test("there are program files to check", () => {
  assert.ok(FILES.length > 1000, `only ${FILES.length} program files found`);
});

test("no program file uses the researcher voice in any field", () => {
  const offenders = [];
  for (const name of FILES) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    for (const text of strings(data)) {
      const hit = text.match(VOICE);
      if (hit) offenders.push(`${name}: "${hit[0]}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Researcher voice found. Use "the program page" or "as of <date>": ${offenders.join("; ")}`
  );
});
