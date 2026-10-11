// Hard rule 4: no Bible, devotional or prayer content in data or teen pages.
// Scans every string in data/*.json and data/programs/*.json, plus src/*.html and assets/js/*.js.
// Fails on a scripture reference (book name + chapter:verse), a KJV-style quoted verse, or a banned word.
// The ALLOWLIST holds the few factual mentions that are allowed. An entry that matches nothing also fails,
// so the list cannot go stale. Plain node, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BOOKS =
  "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|" +
  "Psalms?|Proverbs|Ecclesiastes|Song of Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|" +
  "Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|" +
  "Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation|" +
  "Gen|Ex|Lev|Deut|Matt|Rom|Cor|Gal|Eph|Phil|Col|Thess|Heb|Rev|Ps|Prov|Isa|Jer|Ezek|Dan|Hos|Obad|Mic|Nah|Hab|Zeph|Hag|Zech|Mal";
// Case-sensitive on purpose: book names are capitalized, and this avoids matching ordinary lowercase words.
const SCRIPTURE_REF = new RegExp("\\b(?:" + BOOKS + ")\\.?\\s+\\d{1,3}:\\d{1,3}\\b");
// King James style phrasing that marks a quoted verse.
const KJV_PHRASE = /\b(?:thou|thee|thy|thine|hath|shalt|verily|unto)\b|\bLORD\b/;
const BANNED_WORD = /\b(?:bible|scripture|psalms?|sermons?|devotionals?|prayers?|pray(?:s|ed|ing)?|gospel)\b/gi;

// Each entry covers every occurrence of `term` in `file`. Each must match at least once.
const ALLOWLIST = [
  {
    file: "data/programs/georgia-boys-state.json",
    term: "devotional",
    reason: "Georgia Boys State 2026 memo: the week includes an evening devotional, and families may opt out (factual notice).",
  },
  {
    file: "data/programs/new-jersey-ala-jersey-girls-state.json",
    term: "prayer",
    reason: "NJ Girls State: a nondenominational prayer is part of the program (factual participation rule).",
  },
  {
    file: "data/entries.json",
    term: "devotional",
    reason: "Generated copy of the Georgia Boys State card (factual notice, see its program file).",
  },
  {
    file: "data/entries-detail.json",
    term: "devotional",
    reason: "Generated copy of the Georgia Boys State card (factual notice, see its program file).",
  },
  {
    file: "data/entries.json",
    term: "prayer",
    reason: "Generated copy of the NJ Girls State card (factual participation rule, see its program file).",
  },
  {
    file: "data/entries-detail.json",
    term: "prayer",
    reason: "Generated copy of the NJ Girls State card (factual participation rule, see its program file).",
  },
  {
    file: "data/programs/bloomington-iu-camp-soul.json",
    term: "gospel",
    reason: "IU camp description: gospel is a music style (gospel and blues), not religious content.",
  },
  {
    file: "data/entries.json",
    term: "gospel",
    reason: "Generated copy of the IU camp card: gospel is a music style, not religious content.",
  },
  {
    file: "data/entries-lite.json",
    term: "gospel",
    reason: "Generated copy of the IU camp card: gospel is a music style, not religious content.",
  },
  {
    file: "data/entries-blurb.json",
    term: "gospel",
    reason: "Generated copy of the IU camp card: gospel is a music style, not religious content.",
  },
  {
    file: "src/leaders.html",
    term: "bible",
    reason: "Church-leader page: a pastor or leader picks the Bible reading. Placeholder for the leader, not content.",
  },
  {
    file: "src/leaders.html",
    term: "scripture",
    reason: "Church-leader page: says the weekly questions are about work, not scripture. Placeholder for the leader.",
  },
  {
    file: "src/leaders.html",
    term: "devotional",
    reason: "Church-leader page: a pastor or leader picks any devotional for the week. Placeholder for the leader.",
  },
  {
    file: "src/leaders.html",
    term: "prayer",
    reason: "Church-leader page: a pastor or leader leads any prayer for the week. Placeholder for the leader.",
  },
];

function scanText(file, text) {
  const hits = [];
  const ref = SCRIPTURE_REF.exec(text);
  if (ref) hits.push({ file, term: "scripture-reference", snippet: ref[0] });
  const kjv = KJV_PHRASE.exec(text);
  if (kjv) hits.push({ file, term: "quoted-verse", snippet: kjv[0] });
  for (const m of text.matchAll(BANNED_WORD)) {
    hits.push({ file, term: m[0].toLowerCase(), snippet: text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30) });
  }
  return hits;
}

function collectStrings(value, out) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      collectStrings(v, out);
    }
  }
  return out;
}

function listFiles(dir, ext) {
  const abs = path.join(ROOT, dir);
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => path.posix.join(dir, f));
}

function targetFiles() {
  return [
    ...listFiles("data", ".json"),
    ...listFiles("data/programs", ".json"),
    ...listFiles("src", ".html"),
    ...listFiles("assets/js", ".js"),
  ];
}

function scanRepo() {
  const hits = [];
  for (const rel of targetFiles()) {
    const raw = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (rel.endsWith(".json")) {
      for (const s of collectStrings(JSON.parse(raw), [])) hits.push(...scanText(rel, s));
    } else {
      hits.push(...scanText(rel, raw));
    }
  }
  return hits;
}

test("self-check: poisoned samples are caught", () => {
  const samples = [
    ["scripture reference", "Read John 3:16 with the group."],
    ["quoted verse", 'The card says "Verily I say unto thee, rest."'],
    ["bible word", "Bring a Bible to the session."],
    ["scripture word", "Discuss the scripture of the week."],
    ["psalm word", "Sing a psalm at dinner."],
    ["sermon word", "Attend the sermon on Sunday."],
    ["devotional word", "An evening devotional is held."],
    ["prayer word", "A short prayer opens each day."],
    ["pray word", "Please pray before the interview."],
    ["gospel word", "A gospel choir performs."],
  ];
  for (const [label, text] of samples) {
    assert.ok(scanText("sample.json", text).length > 0, "poisoned sample not caught: " + label);
  }
  assert.equal(scanText("sample.json", "Apply by 11:59 p.m. on March 15 at the job fair.").length, 0);
});

test("allowlist entries name real files and reasons", () => {
  for (const entry of ALLOWLIST) {
    assert.ok(fs.existsSync(path.join(ROOT, entry.file)), "allowlist file missing: " + entry.file);
    assert.ok(entry.reason && entry.reason.length > 20, "allowlist reason too short: " + entry.file);
    assert.ok(!/[\u2013\u2014]/.test(entry.reason), "allowlist reason has a dash: " + entry.file);
  }
});

test("no scripture, devotional or prayer content in data, teen pages or scripts", () => {
  const hits = scanRepo();
  const covered = (h) => ALLOWLIST.some((a) => a.file === h.file && a.term === h.term);
  const bad = hits.filter((h) => !covered(h));
  const lines = bad.map((h) => "  " + h.file + " [" + h.term + "] ..." + h.snippet + "...");
  assert.deepEqual(lines, [], "unallowed religious content found:\n" + lines.join("\n"));
});

test("every allowlist entry still matches something", () => {
  const hits = scanRepo();
  const stale = ALLOWLIST.filter((a) => !hits.some((h) => h.file === a.file && h.term === a.term));
  assert.deepEqual(
    stale.map((a) => a.file + " [" + a.term + "]"),
    [],
    "allowlist entries that no longer match (remove them)",
  );
});
