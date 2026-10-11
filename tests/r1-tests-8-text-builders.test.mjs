// Property-style checks of lib.gradePhrase, lib.splitMessage and lib.planSummary on random odd input.
// Run with: node --test tests/r1-tests-8-text-builders.test.mjs
// To repeat a failing run, set the seed: TIG_SEED=12345 node --test tests/r1-tests-8-text-builders.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const SEED = Number(process.env.TIG_SEED) || 20261010;
const DRAWS = 500;
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(SEED);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const where = (extra) => "seed " + SEED + " (TIG_SEED=" + SEED + ") " + extra;

const TRICKY = [
  "", " ", "   ", "\n", "\t", "a", "10", "10th", "10th grade", "Grade 6", "grade", "GRADE 9", "sophomore", "Senior grade",
  "11", "12", "13", "0", "-1", "1.5", "1e3", "99", "007", "'", "\"", "\"quoted\"", "it's", "<b>x</b>", "&amp;", "%20", "\\",
  "emoji \u{1F600}", "café", "日本語", "‮RTL", "line1\nline2", "line1\r\nline2", "x".repeat(5000), "word ".repeat(400),
  "Subject: Hi\n\nBody here", "Subject:\n\n", "Subject: only", "Subject: A\n\n\n\nB", "Subject: é\n\nsmörgås", "Subject: x\r\n\r\ny"
];
const rawText = () => (rng() < 0.7 ? pick(TRICKY) : pick(TRICKY) + pick(TRICKY));
const rawGrade = () => {
  const r = rng();
  if (r < 0.3) return Math.floor(rng() * 30) - 5;
  if (r < 0.4) return pick([null, undefined, NaN, Infinity, 0, true]);
  return rawText();
};

test("gradePhrase on " + DRAWS + " random inputs (" + SEED + ")", () => {
  for (let i = 0; i < DRAWS; i++) {
    const raw = rawGrade();
    let out;
    assert.doesNotThrow(() => { out = L.gradePhrase(raw); }, where("input " + JSON.stringify(raw)));
    assert.equal(typeof out, "string", where(JSON.stringify(raw)));
    assert.ok(out.length > 0, where(JSON.stringify(raw)));
    assert.ok(out.startsWith("in ") || out.startsWith("a "), where(JSON.stringify(raw) + " -> " + out));
    // Only check for stray words when the input did not itself contain them.
    if (!/undefined/i.test(String(raw))) assert.ok(!/undefined/.test(out), where(JSON.stringify(raw) + " -> " + out));
    if (!/nan/i.test(String(raw))) assert.ok(!/NaN/.test(out), where(JSON.stringify(raw) + " -> " + out));
  }
});

test("gradePhrase gives the right ordinal for grades 1 to 12, in every typed shape", () => {
  const suffix = { 1: "st", 2: "nd", 3: "rd", 11: "th", 12: "th" };
  for (let n = 1; n <= 12; n++) {
    const want = "in " + n + (suffix[n] || "th") + " grade";
    [String(n), n, n + (suffix[n] || "th"), n + " grade", n + (suffix[n] || "th") + " grade", "Grade " + n, "  grade  " + n + " ", String(n).padStart(2, "0")]
      .forEach((raw) => assert.equal(L.gradePhrase(raw), want, where("raw " + JSON.stringify(raw))));
  }
  // Not school grades 1 to 12: kept as typed, never given a wrong ordinal.
  assert.equal(L.gradePhrase(13), "in 13 grade");
  assert.equal(L.gradePhrase(0), "in 0 grade");
  assert.equal(L.gradePhrase(""), "in [grade]");
  assert.equal(L.gradePhrase(null), "in [grade]");
  assert.equal(L.gradePhrase("Sophomore"), "a sophomore");
});

test("splitMessage on " + DRAWS + " random inputs (" + SEED + ")", () => {
  // Documented behavior: "Subject: ...\n\nbody" splits into subject and body, anything else is all body.
  // The function has no length rule, so no part may be longer than the input.
  assert.deepEqual(L.splitMessage(""), { subject: "", body: "" });
  for (let i = 0; i < DRAWS; i++) {
    const msg = rng() < 0.4 ? "Subject: " + rawText().replace(/\n/g, " ") + "\n\n" + rawText() : rawText();
    let out;
    assert.doesNotThrow(() => { out = L.splitMessage(msg); }, where(JSON.stringify(msg).slice(0, 80)));
    assert.equal(typeof out.subject, "string");
    assert.equal(typeof out.body, "string");
    assert.ok(out.subject.length <= msg.length && out.body.length <= msg.length, where("part longer than input"));
    assert.ok(!out.subject.includes("\n"), where("subject has a newline: " + JSON.stringify(out.subject).slice(0, 80)));
    if (out.subject === "" && !/^Subject:\s*\n\n/.test(msg) && !/^Subject:\s*(.*)\n\n/.test(msg)) {
      assert.equal(out.body, msg, where("no subject must return the whole text"));
    } else {
      // The text is "Subject:", then optional whitespace, the subject, a blank line, then the body.
      assert.ok(msg.startsWith("Subject:"), where("split without a Subject line " + JSON.stringify(msg).slice(0, 80)));
      assert.ok(msg.endsWith("\n\n" + out.body), where("body is not the tail " + JSON.stringify(msg).slice(0, 80)));
      const mid = msg.slice("Subject:".length, msg.length - out.body.length - 2);
      assert.equal(mid.replace(/^\s+/, ""), out.subject, where("subject mismatch " + JSON.stringify(msg).slice(0, 80)));
    }
  }
});

function randomPerson() {
  const r = rng();
  if (r < 0.1) return null;
  if (r < 0.15) return undefined;
  const p = {};
  if (rng() < 0.8) p.n = pick(["", " ", "Ana", "  Bo  ", "Zoë", "x".repeat(300), "\"Quote\"", null, undefined]);
  if (rng() < 0.8) p.s = pick(["", "sent", "replied", "meeting", "thanked", "bogus", "SENT", undefined, null]);
  if (rng() < 0.7) p.d = pick(["", "2026-10-09", "2026-02-30", "2026-13-01", "not a date", "2027-01-01", "1999-12-31", null, undefined]);
  return p;
}

test("planSummary on " + DRAWS + " random plans (" + SEED + ")", () => {
  const NOWS = [new Date(2026, 9, 10), new Date(2027, 0, 1), new Date(2026, 11, 31, 23, 59)];
  for (let i = 0; i < DRAWS; i++) {
    const people = [];
    const n = Math.floor(rng() * 8);
    for (let k = 0; k < n; k++) people.push(randomPerson());
    let out;
    assert.doesNotThrow(() => { out = L.planSummary(people, pick(NOWS)); }, where(JSON.stringify(people)));
    assert.ok(Number.isInteger(out.named) && out.named >= 0, where(JSON.stringify(people)));
    assert.ok(Number.isInteger(out.sent) && out.sent >= 0, where(JSON.stringify(people)));
    assert.ok(out.named >= out.sent, where("named < sent " + JSON.stringify(people)));
    assert.ok(out.named <= people.length, where("named > people " + JSON.stringify(people)));
    if (out.next !== null) {
      assert.equal(typeof out.next.name, "string");
      assert.ok(out.next.name.length > 0);
      assert.match(out.next.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(typeof out.next.due, "boolean");
      assert.ok(!/undefined|NaN/.test(JSON.stringify(out)), where(JSON.stringify(out)));
    }
  }
  assert.deepEqual(L.planSummary([], new Date(2026, 9, 10)), { named: 0, sent: 0, next: null });
});
