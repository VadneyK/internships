// Ticket r3-tests-4: every phone number in the data and pages looks like a real US number.
// Scans data/*.json and data/programs/*.json (every string value), src/*.html and assets/js/*.js
// (raw text). Fails on: an area code or exchange that starts with 0 or 1, an area code ending in 11,
// the fictional 555-0100 to 555-0199 range, and an unbalanced bracket such as "(999-999-9999".
// ALLOWLIST holds the only exceptions. Do not add to it to make a new number pass: fix the source.
// The count by format is printed as a report and never fails the test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// file: repo-relative path. text: the exact phone text as it appears. reason: why it is allowed.
const ALLOWLIST = [
  { file: "src/resume.html", text: "(510) 555-0142", reason: "sample resume line" },
  // The pg-parks-youth-advisory-council unclosed-bracket typo entries were removed: the card was fixed
  // in the fact-checked data, so the text is gone from the program file and the generated files.
];
const isAllowed = (file, text) => ALLOWLIST.some((a) => a.file === file && a.text === text);

// Groups: 1 optional "(" before the number, 2 optional "+1" or "1" prefix, 3 area code (with its own
// brackets when it has them), 4 separator, 5 exchange, 6 dash or dot, 7 line, 8 optional ")" after.
// The lookbehind stops matches inside longer digit runs, dates and dashed ids.
const PHONE = /(?<![\d+.-])(\(?)(\+?1[-. ]?)?(\(\d{3}\)|\d{3})([-. ]?)(\d{3})([-.])(\d{4})(?!\d)(\)?)/g;
// A ")" right after the area code with no "(" before it, such as "510) 555-0142".
const STRAY_CLOSE = /(?<![\d(])\d{3}\)[-. ]\d{3}[-.]\d{4}/g;

// Format label for the report.
export function formatOf(m) {
  const style = m[3].startsWith("(") ? "(999) 999-9999" : m[6] === "." ? "999.999.9999" : "999-999-9999";
  return `${style}, ${m[2] ? "with 1 prefix" : "no prefix"}`;
}

// Returns the problems for one PHONE match. An empty list means the number looks real.
export function problemsOf(m) {
  const probs = [];
  const area = m[3].replace(/[()]/g, "");
  const exch = m[5];
  const line = Number(m[7]);
  if (m[1] === "(" && m[8] !== ")") probs.push("unbalanced bracket: missing ')'");
  if (area[0] === "0" || area[0] === "1") probs.push(`area code ${area} starts with 0 or 1`);
  if (area.endsWith("11")) probs.push(`area code ${area} ends in 11`);
  if (exch[0] === "0" || exch[0] === "1") probs.push(`exchange ${exch} starts with 0 or 1`);
  if (exch === "555" && line >= 100 && line <= 199) probs.push(`555-${m[7]} is in the 0100 to 0199 fictional range`);
  return probs;
}

// Every phone-like match in one text, with its problems. Used by the scan and by the self-tests.
export function scanText(text) {
  const hits = [];
  for (const m of text.matchAll(STRAY_CLOSE)) hits.push({ token: m[0], format: "stray ')' after area code", probs: ["unbalanced bracket: ')' with no '('"] });
  for (const m of text.matchAll(PHONE)) hits.push({ token: m[0], format: formatOf(m), probs: problemsOf(m) });
  return hits;
}

function sources() {
  const out = [];
  for (const d of ["data", "data/programs"]) {
    const dir = join(root, d);
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
      const rel = `${d}/${f}`;
      const walk = (v) => {
        if (typeof v === "string") out.push({ file: rel, text: v });
        else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") Object.values(v).forEach(walk);
      };
      walk(JSON.parse(readFileSync(join(dir, f), "utf8")));
    }
  }
  for (const [d, ext] of [["src", ".html"], ["assets/js", ".js"]]) {
    const dir = join(root, d);
    for (const f of readdirSync(dir).filter((x) => x.endsWith(ext)).sort()) {
      out.push({ file: `${d}/${f}`, text: readFileSync(join(dir, f), "utf8") });
    }
  }
  return out;
}

const all = sources();
const counts = new Map();
const failures = [];
const seen = new Set();
for (const { file, text } of all) {
  for (const hit of scanText(text)) {
    counts.set(hit.format, (counts.get(hit.format) || 0) + 1);
    if (!hit.probs.length || isAllowed(file, hit.token)) continue;
    const key = `${file} ${hit.token} ${hit.probs.join(";")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    failures.push(`${file}: "${hit.token}" ${hit.probs.join("; ")}`);
  }
}

test("every phone number in data, pages and scripts looks like a real US number", () => {
  assert.deepEqual(failures, [], `phone numbers that look wrong:\n  ${failures.join("\n  ")}`);
});

test("report: phone-like strings found, by format (not a failure)", () => {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const lines = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([f, c]) => `  ${String(c).padStart(5)}  ${f}`);
  console.log(`phone-like strings found: ${total} (in ${all.length} sources)\n${lines.join("\n")}`);
  assert.ok(total > 0);
});

test("allow list entries are still needed and still present", () => {
  for (const a of ALLOWLIST) {
    assert.ok(all.some((s) => s.file === a.file && s.text.includes(a.text)), `allow list text not found in ${a.file}: ${a.text}`);
  }
});

// Self-tests: the rules fire on bad numbers and pass good ones.
const probsFor = (s) => scanText(s).flatMap((h) => h.probs);
test("rules: a good number passes", () => {
  assert.deepEqual(probsFor("Call (510) 555-0299 or 415-867-5309 or 212.646.0110 or 1-800-246-4646."), []);
});
test("rules: an area code or exchange starting with 0 or 1 fails", () => {
  assert.ok(probsFor("Call 015-867-5309.").some((p) => p.includes("area code 015")));
  assert.ok(probsFor("Call 415-167-5309.").some((p) => p.includes("exchange 167")));
});
test("rules: an area code ending in 11 fails", () => {
  assert.ok(probsFor("Dial 311-867-5309.").some((p) => p.includes("ends in 11")));
});
test("rules: the 555-0100 to 555-0199 range fails, other 555 lines pass", () => {
  assert.ok(probsFor("Call 415-555-0150.").some((p) => p.includes("fictional range")));
  assert.deepEqual(probsFor("Call 415-555-0250."), []);
});
test("rules: an unbalanced bracket fails, a bracket around the whole number passes", () => {
  assert.ok(probsFor("Ask at (999-999-9999 for help.").length > 0);
  assert.deepEqual(probsFor("Ask at (630-256-3416) for help."), []);
  assert.deepEqual(probsFor("Ask at ((415) 931-9622) for help."), []);
});
test("rules: a stray close bracket after the area code fails", () => {
  assert.ok(probsFor("Call 510) 555-0142 now.").length > 0);
});
test("rules: digits inside longer runs (dates, ids) are not phone numbers", () => {
  assert.deepEqual(scanText("Updated 2026-10-10 and id 12-345-6789-0123."), []);
});
