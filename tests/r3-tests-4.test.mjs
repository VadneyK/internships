import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r3-tests-4. Reading level ratchet for card text and page prose.
// The site rule is plain words at about an 8th grade level. This file measures the
// Flesch-Kincaid grade of the card fields and the page prose, and fails if the numbers
// get worse than the constants below. It also fails if the numbers get clearly better,
// so the constants get tightened and the gain is locked in.
//
// When content improves: lower the constants to the new measured values (the failure
// message prints them). Never raise a constant to make a new card pass; rewrite the card.

// ---- Constants measured on 2026-10-10 after the 856 card rewrite. The cards added later were written to stay within the counts. On 2026-10-10 the 240 cards of the city data wave were rewritten in plainer words, and the four card constants were lowered to the new measured values (lower them when content improves) ----
const MEASURED = {
  fields: {
    what_you_do: { mean: 6.64, aboveLimit: 177 },
    who_can_apply: { mean: 6.3, aboveLimit: 280 },
    how_to_apply: { mean: 7.34, aboveLimit: 460 },
    notes: { mean: 6.39, aboveLimit: 268 },
  },
  pages: { mean: 4.87, aboveLimit: 0 },
};
const GRADE_LIMIT = 8; // a text above this grade counts in the "above 8" tally
const STALE_GRADE_SLACK = 0.5; // real mean this far below the constant means the constant is stale
const STALE_COUNT_SLACK = 5; // real count this far below the constant means the constant is stale

// ---- Flesch-Kincaid grade ----
// grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
export function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  let n = (w.match(/[aeiouy]+/g) || []).length;
  // silent e: a final "e" does not add a syllable, except consonant + "le" (table, little)
  if (n > 1 && /e$/.test(w) && !/[^aeiouy]le$/.test(w)) n -= 1;
  return Math.max(1, n);
}

export function fkGrade(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const sentences = clean.split(/[.!?]+(?:\s+|$)/).filter((s) => /[A-Za-z]/.test(s));
  const words = clean.match(/[A-Za-z']+/g) || [];
  if (!sentences.length || !words.length) return null;
  const syl = words.reduce((a, w) => a + countSyllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}

// ---- Page prose: visible main text of a src page ----
function stripHtml(html) {
  return html
    .replace(/^[\s\S]*?\n---\n/, "") // front matter block (title, desc, scripts)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|nav|table|svg|template|noscript|select|button|header|footer)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|dd|dt|summary|blockquote)>/gi, ". ") // a paragraph is one sentence break
    .replace(/<\/(li|h[1-6])>/gi, " ") // list items and headings join the text around them
    .replace(/<\/(ul|ol)>/gi, ". ") // a whole list is one sentence break
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&rsaquo;|&raquo;|&middot;|&bull;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(\.\s*){2,}/g, ". ")
    .trim();
}

// ---- Unit tests on four hand-checked sentences ----
// Syllables use vowel groups, minus one for a silent final e.
test("fkGrade: 'The cat sat.' is 3 words, 3 syllables, 1 sentence = -2.62", () => {
  // 0.39*3 + 11.8*(3/3) - 15.59 = 1.17 + 11.8 - 15.59
  assert.ok(Math.abs(fkGrade("The cat sat.") - -2.62) < 0.005);
});
test("fkGrade: 'I like to read books.' is 5 words, 5 syllables = -1.84", () => {
  // like = 2 vowel groups minus the silent e = 1; 0.39*5 + 11.8*1 - 15.59
  assert.ok(Math.abs(fkGrade("I like to read books.") - -1.84) < 0.005);
});
test("fkGrade: 'Students apply online.' is 3 words, 6 syllables = 9.18", () => {
  // stu-dents 2, ap-ply 2, on-line 3 groups minus silent e = 2; 0.39*3 + 11.8*2 - 15.59
  assert.ok(Math.abs(fkGrade("Students apply online.") - 9.18) < 0.005);
});
test("fkGrade: two sentences, 'Apply now. Call us today!' = 1.905", () => {
  // 5 words, 7 syllables (today = o + ay = 2), 2 sentences; 0.39*2.5 + 11.8*1.4 - 15.59
  assert.ok(Math.abs(fkGrade("Apply now. Call us today!") - 1.905) < 0.005);
});
test("fkGrade: empty text has no grade; sentence split needs a space after the mark", () => {
  assert.equal(fkGrade(""), null);
  assert.equal(fkGrade("   "), null);
  // "3.5" is not a sentence break, so this is one sentence of 2 words
  const one = fkGrade("Pay 3.5 hours");
  assert.ok(one !== null);
});

// ---- Load the repo ----
const progDir = new URL("../data/programs/", import.meta.url);
const CARDS = fs
  .readdirSync(progDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(fs.readFileSync(new URL(f, progDir), "utf8")));

const srcDir = new URL("../src/", import.meta.url);
const PAGES = fs
  .readdirSync(srcDir)
  .filter((f) => f.endsWith(".html") && !f.startsWith("_"))
  .sort()
  .map((f) => ({ id: f, text: stripHtml(fs.readFileSync(new URL(f, srcDir), "utf8")) }));

function summarize(items) {
  const graded = items.filter((i) => i.grade !== null);
  const mean = graded.reduce((a, i) => a + i.grade, 0) / (graded.length || 1);
  const aboveLimit = graded.filter((i) => i.grade > GRADE_LIMIT).length;
  const worst = [...graded].sort((a, b) => b.grade - a.grade).slice(0, 10);
  return { n: graded.length, mean, aboveLimit, worst };
}
const fmtWorst = (s) => s.worst.map((w) => `${w.id} ${w.grade.toFixed(1)}`).join("; ");
const round2 = (x) => Math.round(x * 100) / 100;

function checkRatchet(label, real, limit) {
  const msg =
    `${label}: mean ${round2(real.mean)} (limit ${limit.mean}), above grade ${GRADE_LIMIT}: ` +
    `${real.aboveLimit} (limit ${limit.aboveLimit}). 10 worst: ${fmtWorst(real)}`;
  assert.ok(real.mean <= limit.mean + 0.005, `Reading level got worse. ${msg}`);
  assert.ok(real.aboveLimit <= limit.aboveLimit, `Too many hard texts. ${msg}`);
  assert.ok(
    real.mean >= limit.mean - STALE_GRADE_SLACK,
    `Ratchet is stale, tighten the mean constant to ${round2(real.mean)}. ${msg}`,
  );
  assert.ok(
    real.aboveLimit >= limit.aboveLimit - STALE_COUNT_SLACK,
    `Ratchet is stale, tighten the above-limit constant to ${real.aboveLimit}. ${msg}`,
  );
}

for (const field of Object.keys(MEASURED.fields)) {
  test(`reading level ratchet: card field ${field}`, () => {
    const items = CARDS.map((c) => ({ id: c.id, grade: fkGrade(c[field]) }));
    const real = summarize(items);
    if (process.env.RATCHET_PRINT) console.log(field, round2(real.mean), real.aboveLimit, real.n);
    checkRatchet(`card ${field}`, real, MEASURED.fields[field]);
  });
}

test("reading level ratchet: page prose in src/*.html", () => {
  const items = PAGES.map((p) => ({ id: p.id, grade: fkGrade(p.text) }));
  const real = summarize(items);
  if (process.env.RATCHET_PRINT) console.log("pages", round2(real.mean), real.aboveLimit, real.n, fmtWorst(real));
  checkRatchet("page prose", real, MEASURED.pages);
});

test("ratchet sanity: the repo has cards and pages with prose", () => {
  assert.ok(CARDS.length > 500, "expected 500+ cards");
  assert.ok(PAGES.length >= 15, "expected 15+ src pages");
  // tiny pages such as 404.html have too little text to grade; the rest must have real prose
  const prose = PAGES.filter((p) => p.text.length > 300);
  assert.ok(prose.length >= 15, `only ${prose.length} pages have visible prose`);
});
