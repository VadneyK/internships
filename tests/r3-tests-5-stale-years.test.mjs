// Ratchet: years in card dates and page prose are current, or named as past.
// Part 1: open-type cards whose deadline_text names only 2024 or 2025 must be in ALLOWLIST_CARDS.
// Part 2: in src/*.html prose, a year from 2015 to 2025 needs a past-marker word within 60 characters, or an entry in ALLOWLIST_PAGES.
// Part 3: no year after 2027 in page prose or in a card's deadline_iso.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const SRC = path.join(ROOT, "src");
const pages = fs.readdirSync(SRC).filter((f) => f.endsWith(".html")).sort();

// Cards that stay on the list with an old year only. Remove an entry when its text is fixed.
const ALLOWLIST_CARDS = {
  "philadelphia-workready-boost": "text says the page is out of date (it still lists 2025 summer jobs)",
};

// Page prose years with no past-marker word nearby. count is how many unmarked times the year appears on that page.
const ALLOWLIST_PAGES = [
  { page: "index.html", year: 2024, count: 1, reason: "source note: data through December 2024" },
  { page: "index.html", year: 2025, count: 1, reason: "source name: Gem 2025 Recruiting Benchmarks" },
  { page: "insights.html", year: 2024, count: 1, reason: "source note: data through December 2024" },
  { page: "insights.html", year: 2025, count: 1, reason: "source name: Gem 2025 Benchmarks Report" },
  { page: "insights.html", year: 2022, count: 1, reason: "citation: Rajkumar and others, Science 2022" },
  { page: "insights.html", year: 2018, count: 1, reason: "citation: Van Dam and others, 2018" },
  { page: "insights.html", year: 2015, count: 1, reason: "citation: Timpe and Lunkenheimer, 2015" },
  { page: "ready.html", year: 2024, count: 1, reason: "dated source: a 2024 form for Davis youth fares" },
  { page: "ready.html", year: 2022, count: 1, reason: "citation: Boston SuccessLink, 2022 data" },
  { page: "ready.html", year: 2023, count: 1, reason: "citation: BBB Institute, 2023" },
  { page: "resume.html", year: 2025, count: 2, reason: "sample resume lines such as 2025 to present" },
  { page: "resume.html", year: 2024, count: 1, reason: "sample resume line: 2024 to present" },
  { page: "rules.html", year: 2024, count: 1, reason: "link title: FTC top scams of 2024" },
];

const MARKER = /\b(was|were|last|in|since|from|ago|as of|read|updated)\b/i;

function prose(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function yearHits(text, re) {
  const out = [];
  for (const m of text.matchAll(re)) {
    const i = m.index;
    out.push({ year: Number(m[1]), before: text.slice(Math.max(0, i - 60), i), after: text.slice(i + m[1].length, i + m[1].length + 60), snippet: text.slice(Math.max(0, i - 60), i + m[1].length + 60).replace(/\s+/g, " ") });
  }
  return out;
}

test("part 1: open-type cards do not carry only an old year in deadline_text", () => {
  const open = new Set(["open-now", "opens-soon", "rolling", "year-round"]);
  const stale = entries.filter((e) => open.has(e.status) && /(?<!\d)202[45](?!\d)/.test(e.deadline_text || "") && !/(?<!\d)202[67](?!\d)/.test(e.deadline_text || ""));
  const bad = stale.filter((e) => !(e.id in ALLOWLIST_CARDS));
  assert.deepEqual(bad.map((e) => `${e.id}: ${e.deadline_text}`), [], "card shows only an old year; fix the text or allowlist it with a reason");
  const ids = new Set(stale.map((e) => e.id));
  const gone = Object.keys(ALLOWLIST_CARDS).filter((id) => !ids.has(id));
  assert.deepEqual(gone, [], "allowlist entry no longer matches a stale card; remove it");
});

test("part 2: past years in page prose sit near a past-marker word or are allowlisted", () => {
  const found = {};
  const problems = [];
  for (const page of pages) {
    const text = prose(fs.readFileSync(path.join(SRC, page), "utf8"));
    for (const h of yearHits(text, /(?<!\d)(20(?:1[5-9]|2[0-5]))(?!\d)/g)) {
      if (MARKER.test(h.before) || MARKER.test(h.after)) continue;
      const key = `${page}|${h.year}`;
      (found[key] ||= []).push(h.snippet);
    }
  }
  const allowed = new Map(ALLOWLIST_PAGES.map((a) => [`${a.page}|${a.year}`, a]));
  for (const [key, snippets] of Object.entries(found)) {
    const a = allowed.get(key);
    if (!a) problems.push(`${key.replace("|", " ")}: year with no past-marker word and no allowlist entry: ${snippets.join(" || ")}`);
    else if (a.count !== snippets.length) problems.push(`${key.replace("|", " ")}: allowlist says ${a.count}, found ${snippets.length}: ${snippets.join(" || ")}`);
  }
  for (const a of ALLOWLIST_PAGES) {
    if (!found[`${a.page}|${a.year}`]) problems.push(`${a.page} ${a.year}: allowlist entry no longer matches; remove it`);
  }
  assert.deepEqual(problems, []);
});

test("part 3: no year after 2027 in page prose or card deadline_iso", () => {
  const problems = [];
  for (const page of pages) {
    const text = prose(fs.readFileSync(path.join(SRC, page), "utf8"));
    for (const h of yearHits(text, /(?<!\d)(20(?:2[89]|[3-9]\d))(?!\d)/g)) problems.push(`${page}: ${h.snippet}`);
  }
  for (const e of entries) {
    const m = /(?<!\d)(20(?:2[89]|[3-9]\d))(?!\d)/.exec(e.deadline_iso || "");
    if (m) problems.push(`${e.id}: deadline_iso ${e.deadline_iso}`);
  }
  assert.deepEqual(problems, []);
});
