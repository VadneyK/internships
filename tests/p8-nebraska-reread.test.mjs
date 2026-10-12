// Nebraska re-read (ticket p8-nebraska-reread).
// The official page puts Federal limits in the left column of its hours table and
// Nebraska limits in the right column. The hours text must keep those apart and
// say which weeks each limit is for. Every dollar figure in the ne wage row must
// appear in its short quote, and the youth line must be stated on the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
const lite = load("states-lite.json").states.find((r) => r.id === "ne");
const wage = load("state-wages.json").states.find((r) => r.id === "ne");
const DOLLAR = /\$\d+(?:,\d{3})*(?:\.\d+)?/g;
const words = (s) => s.split(/\s+/).filter(Boolean).length;

test("ne hours: Nebraska and federal limits are named apart", () => {
  const h = lite.hours;
  const sentences = h.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const nebraska = sentences.find((s) => /^Nebraska limits/.test(s));
  const federal = sentences.find((s) => /^Federal limits: /.test(s));
  assert.ok(nebraska && federal, "one sentence for Nebraska limits and one for federal limits");
  assert.match(nebraska, /8 hours in one day/);
  assert.match(nebraska, /48 hours in one week/);
  assert.doesNotMatch(nebraska, /\b3 hours\b|\b18 hours\b|\b40 hours\b/, "the school day numbers are federal, not Nebraska");
  assert.match(federal, /3 hours on a school day/);
  assert.match(federal, /18 hours in a school week/);
  assert.match(federal, /40 hours in a non-school week/);
});

test("ne hours: says which weeks each limit is for", () => {
  const h = lite.hours;
  assert.match(h, /school week/);
  assert.match(h, /non-school week/);
  assert.match(h, /does not say whether the 8 and 48 hour limits are for school weeks or non-school weeks/);
  assert.match(h, /more restrictive/);
  assert.match(h, /inferred from the page layout/, "the column split is our inference from the page layout");
});

// Lower-case, drop articles (a, an, the; not "a.m."), and collapse spaces so that
// "a school week" and "school week" compare equal on both sides.
const plain = (s) => s.toLowerCase().replace(/\b(?:a|an|the)\b(?!\.)/g, " ").replace(/\s+/g, " ").trim();

test("ne hours: each claim in hours is in source_excerpt", () => {
  const h = plain(lite.hours);
  const ex = plain(lite.source_excerpt);
  const claims = [
    "8 hours in one day",
    "48 hours in one week",
    "not before 6 a.m.",
    "after 10 p.m.",
    "3 hours on a school day",
    "18 hours in a school week",
    "8 hours on a non-school day",
    "40 hours in a non-school week",
    "not before 7 a.m.",
    "after 7 p.m.",
    "9 p.m. from June 1",
    "more restrictive",
  ];
  for (const c of claims) {
    assert.ok(h.includes(plain(c)), "claim is in hours: " + c);
    assert.ok(ex.includes(plain(c)), "claim is in source_excerpt: " + c);
  }
});

test("ne hours: every number in hours appears in source_excerpt", () => {
  for (const n of new Set(lite.hours.match(/\d+/g))) {
    assert.match(lite.source_excerpt, new RegExp("(^|[^\\d])" + n + "([^\\d]|$)"), "number " + n + " is in the excerpt");
  }
});

test("ne hours: no dash characters and every sentence is short", () => {
  for (const f of [lite.hours, lite.quote, lite.source_excerpt, wage.youth, wage.quote, wage.source_excerpt]) {
    assert.doesNotMatch(f, /[\u2013\u2014]/);
  }
  for (const s of lite.hours.split(/(?<=[.!?])\s+(?=[A-Z])/)) assert.ok(words(s) <= 45, s);
});

test("ne hours: the quote is short and sits in the source excerpt", () => {
  assert.ok(words(lite.quote) < 15, "quote under 15 words");
  assert.ok(lite.source_excerpt.includes(lite.quote), "quote is word for word in the excerpt");
  for (const n of ["8 hours in one day", "48 hours in one week"]) assert.ok(lite.quote.includes(n), n);
});

test("ne wage: every dollar figure in the row appears in its quote", () => {
  assert.ok(words(wage.quote) < 15, "quote under 15 words");
  for (const f of ["wage", "youth"]) {
    const figs = wage[f].match(DOLLAR) || [];
    assert.ok(figs.length, f + " has a figure");
    for (const fig of figs) assert.ok(wage.quote.includes(fig), f + " figure " + fig + " is in the quote");
  }
});

test("ne wage: the quote sits inside the source excerpt, which holds the youth and training lines", () => {
  assert.ok(wage.source_excerpt.includes(wage.quote), "wage quote is word for word in source_excerpt");
  assert.match(wage.youth, /14 or 15/);
  assert.match(wage.youth, /\$13\.50 an hour/);
  assert.match(wage.youth, /16 to 19/);
  assert.match(wage.youth, /first 90 days/);
  assert.match(wage.youth, /The page says the 16 to 19 training wage does not apply to seasonal or migrant workers\./);
  assert.match(wage.source_excerpt, /Beginning July 18, 2026, an employer may pay a youth minimum wage of \$13\.50 per hour to employees who are 14 or 15 years of age\./);
  assert.match(wage.source_excerpt, /not a seasonal or migrant worker/);
});
