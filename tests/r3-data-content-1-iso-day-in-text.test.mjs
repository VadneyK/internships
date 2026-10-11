// Every opens_iso / deadline_iso day must be written in the card's deadline_text,
// so the site never shows a day nobody posted.
// Run with: node --test tests/r3-data-content-1-iso-day-in-text.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entries = JSON.parse(readFileSync(join(root, "data/entries.json"), "utf8"));

// Event whose text says it runs through October 2026, with no single day.
const ALLOW = new Set(["hacktoberfest-2026"]);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dayIsInText(iso, text) {
  const [, m, d] = iso.split("-").map(Number);
  const name = MONTHS[m - 1];
  const re = new RegExp(`\\b(?:${name}|${name.slice(0, 3)}\\.?)\\s+0?${d}(?!\\d)`, "i");
  return re.test(text || "");
}

test("every opens_iso and deadline_iso day is written in deadline_text", () => {
  const bad = [];
  for (const e of entries) {
    if (ALLOW.has(e.id)) continue;
    for (const k of ["opens_iso", "deadline_iso"]) {
      if (e[k] && !dayIsInText(e[k], e.deadline_text)) bad.push(`${e.id} ${k}=${e[k]}: ${e.deadline_text}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("the allow list is exactly hacktoberfest-2026 and it still needs it", () => {
  assert.deepEqual([...ALLOW], ["hacktoberfest-2026"]);
  const h = entries.find((e) => e.id === "hacktoberfest-2026");
  assert.ok(h, "hacktoberfest-2026 exists");
});

test("the day check rejects a month-only text", () => {
  assert.equal(dayIsInText("2026-12-01", "Applications open in December 2026 (exact day not posted)."), false);
  assert.equal(dayIsInText("2026-12-01", "Opens Dec 1, 2026."), true);
});
