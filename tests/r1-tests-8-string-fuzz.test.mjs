// Hostile and odd input to the string helpers in assets/js/lib.js: esc, safeUrl, mailtoHref, smsHref,
// splitMessage, gradePhrase and ageText.
// Run with: node --test tests/r1-tests-8-string-fuzz.test.mjs
// Random cases come from a seeded generator, so a failure repeats on every run.
// Already covered elsewhere and not repeated here: mailtoHref/smsHref round trips (tests/r3-tests-6.test.mjs),
// safeUrl basics (tests/r2-tests-3.test.mjs), gradePhrase and splitMessage random shapes (tests/r1-tests-8-text-builders.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
globalThis.self = globalThis;
const L = createRequire(import.meta.url)("../assets/js/lib.js");

/* mulberry32: a small seeded PRNG. Same seed, same sequence. */
function prng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

const ENTITY = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const unescapeHtml = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITY[m]);

/* ---------- esc ---------- */

const ESC_PIECES = ["<", ">", "\"", "'", "&", "&amp;", "&lt;", "&#39;", "<script>", "a", "Z", "7", " ", "\n", "\t",
  "é", "中", "😀", "\u{1F469}‍\u{1F4BB}", "=", "/", "\\", "`", "%", "+", " ", " ", "x".repeat(20)];

test("esc: 500 seeded random strings lose every raw < > \" ' & and decode back exactly", () => {
  const r = prng(81001);
  for (let i = 0; i < 500; i++) {
    let s = "";
    const n = Math.floor(r() * 12);
    for (let k = 0; k < n; k++) s += pick(r, ESC_PIECES);
    const out = L.esc(s);
    assert.equal(typeof out, "string", "case " + i);
    // Every & must start one of the entities esc makes, and no other < > " ' may appear.
    const leftover = out.replace(/&(amp|lt|gt|quot|#39);/g, "");
    assert.ok(!/[&<>"']/.test(leftover), "raw character left in case " + i + ": " + JSON.stringify(out));
    assert.equal(unescapeHtml(out), s, "decode mismatch in case " + i);
  }
});

test("esc: fixed hostile strings, emoji, and non-string input", () => {
  assert.equal(L.esc("<img src=x onerror=alert(1)>"), "&lt;img src=x onerror=alert(1)&gt;");
  assert.equal(L.esc("\"'&"), "&quot;&#39;&amp;");
  assert.equal(L.esc("&amp;"), "&amp;amp;", "an existing entity is escaped, not kept");
  assert.equal(L.esc("😀 café"), "😀 café");
  assert.equal(L.esc(null), "");
  assert.equal(L.esc(undefined), "");
  assert.equal(L.esc(0), "0");
  assert.equal(L.esc(42), "42");
  assert.equal(L.esc(false), "false");
});

/* ---------- safeUrl ---------- */

test("safeUrl: rejects javascript:, data:, vbscript:, uppercase, tab and newline split variants", () => {
  const bad = [
    "javascript:alert(1)", "JAVASCRIPT:alert(1)", "JavaScript:alert(1)", " javascript:alert(1)", "\tjavascript:alert(1)",
    "java\tscript:alert(1)", "java\nscript:alert(1)", "java\rscript:alert(1)", "java\u0000script:alert(1)",
    "data:text/html,<b>x</b>", "DATA:text/html,x", "vbscript:msgbox(1)", "VBScript:msgbox(1)", "vbs\tcript:x",
    "//evil.example", "https:/one-slash.example", "https//no-colon.example", "ftp://files.example"
  ];
  for (const u of bad) assert.equal(L.safeUrl(u), "", JSON.stringify(u));
});

test("safeUrl: rejects whitespace and control characters inside or around an http link", () => {
  const bad = [" https://a.example", "https://a.example ", "https://a example", "https://a.example\t", "https://a.example\n",
    "https://a.example\r\nX-Injected: 1", "https://a.example\x00", "https://a\u0007b.example", "https://", "http://", "https:// a.example"];
  for (const u of bad) assert.equal(L.safeUrl(u), "", JSON.stringify(u));
});

test("safeUrl: non-string input gives an empty string", () => {
  for (const u of [null, undefined, 0, 42, true, NaN, {}, [], ["https://a.example"], () => "https://a.example"]) {
    assert.equal(L.safeUrl(u), "", String(u));
  }
});

test("safeUrl: plain https and http links are kept exactly", () => {
  const good = ["https://example.org", "http://example.org", "HTTP://EXAMPLE.ORG", "https://example.org/path?x=1&y=2#z",
    "https://a.example/%E2%9C%93", "https://xn--caf-dma.example/", "https://user:pw@example.org:8443/a"];
  for (const u of good) assert.equal(L.safeUrl(u), u, JSON.stringify(u));
});

test("safeUrl: 500 seeded strings are either empty or the same http(s) link with no whitespace", () => {
  const r = prng(81002);
  const PIECES = ["https://", "http://", "HTTPS://", "javascript:", "java\tscript:", "data:", " ", "\n", "\t", "a.example", "/x", "?q=1", "#f", "\u0000", "%20", " "];
  let kept = 0;
  for (let i = 0; i < 500; i++) {
    let s = "";
    const n = Math.floor(r() * 6);
    for (let k = 0; k < n; k++) s += pick(r, PIECES);
    const out = L.safeUrl(s);
    assert.ok(out === "" || out === s, "changed input in case " + i + ": " + JSON.stringify(s));
    if (out !== "") {
      kept++;
      assert.match(out, /^https?:\/\/[^\s\x00-\x1f\x7f]+$/i, "bad kept link " + JSON.stringify(out));
    }
  }
  assert.ok(kept > 0, "the generator should produce some good links");
});

/* ---------- splitMessage: words survive the split ---------- */

test("splitMessage: 500 seeded messages keep every word, in order, across subject and body", () => {
  const r = prng(81003);
  const WORDS = ["Hi", "Sam,", "thanks!", "café", "中文", "😀", "it's", "\"quoted\"", "<b>", "a&b", "100%", "x".repeat(40), "#1", "Subject:", "body:"];
  const wordsOf = (s) => s.split(/\s+/).filter(Boolean);
  for (let i = 0; i < 500; i++) {
    const subjWords = Array.from({ length: Math.floor(r() * 6) }, () => pick(r, WORDS));
    const bodyWords = Array.from({ length: Math.floor(r() * 30) }, () => pick(r, WORDS));
    const joiner = r() < 0.5 ? " " : "\n";
    const msg = "Subject: " + subjWords.join(" ") + "\n\n" + bodyWords.join(joiner);
    const out = L.splitMessage(msg);
    assert.deepEqual(wordsOf(out.subject), subjWords, "subject words, case " + i);
    assert.deepEqual(wordsOf(out.body), bodyWords, "body words, case " + i);
    assert.deepEqual(wordsOf(out.subject).concat(wordsOf(out.body)), wordsOf(msg).slice(1), "rejoin, case " + i);
  }
});

test("splitMessage: a plain message with no Subject line stays whole, word for word", () => {
  for (const msg of ["Hello there", "Subject: no blank line after", "Dear Sam,\n\nSubject: not the first line"]) {
    assert.deepEqual(L.splitMessage(msg), { subject: "", body: msg }, JSON.stringify(msg));
  }
});

/* ---------- gradePhrase and ageText across ages 5 to 25 and null ---------- */

const AGES = [];
for (let a = 5; a <= 25; a++) AGES.push(a);
AGES.push(null);

test("gradePhrase: ages 5 to 25 and null always give a real phrase, never undefined or null", () => {
  for (const a of AGES) {
    const out = L.gradePhrase(a);
    assert.equal(typeof out, "string", String(a));
    assert.ok(out.length > 0, String(a));
    assert.ok(!/undefined|null|NaN/.test(out), String(a) + " -> " + out);
    assert.ok(out.startsWith("in ") || out.startsWith("a "), String(a) + " -> " + out);
  }
});

test("ageText: every min and max from 5 to 25, plus null, gives a real line that follows the rule", () => {
  const rule = (min, max) => {
    if (min != null && max != null) return "Ages " + min + " to " + max;
    if (min != null) return "Ages " + min + "+";
    if (max != null) return "Up to age " + max;
    return "All high school ages";
  };
  let n = 0;
  for (const min_age of AGES) for (const max_age of AGES) {
    const out = L.ageText({ min_age, max_age });
    assert.equal(typeof out, "string", JSON.stringify({ min_age, max_age }));
    assert.ok(!/undefined|null|NaN/.test(out), JSON.stringify({ min_age, max_age }) + " -> " + out);
    assert.equal(out, rule(min_age, max_age), JSON.stringify({ min_age, max_age }));
    n++;
  }
  assert.equal(n, 22 * 22);
});

test("ageText: a missing grades field adds nothing, and a grades string is appended", () => {
  assert.equal(L.ageText({ min_age: 14, max_age: 18, grades: null }), "Ages 14 to 18");
  assert.equal(L.ageText({ min_age: 14, max_age: 18, grades: "9 to 12" }), "Ages 14 to 18 · Grades 9 to 12");
});
