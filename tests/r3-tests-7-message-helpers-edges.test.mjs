// Edge cases for the message helpers in assets/js/lib.js: blanksLeft, splitMessage, mailtoHref and smsHref.
// These pin the current behavior on awkward teen-typed and template text. If a case shows a real bug,
// it is reported, not fixed here.
// Run with: node --test tests/r3-tests-7-message-helpers-edges.test.mjs
// Every random input comes from a seeded generator, so a failure is the same on every run.
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

/* Split an href's query string into [name, decoded value] pairs. Empty pieces (from "?&") are dropped. */
function decodeQuery(href, prefix) {
  assert.ok(href.startsWith(prefix), "href starts with " + prefix + " but is " + href);
  return href.slice(prefix.length).split("&").filter(Boolean).map((piece) => {
    const i = piece.indexOf("=");
    assert.ok(i > 0, "query piece has a name and =: " + piece);
    return [piece.slice(0, i), decodeURIComponent(piece.slice(i + 1))];
  });
}

/* ---------- blanksLeft ---------- */

test("blanksLeft: null, undefined, a number and an empty string give no blanks and do not throw", () => {
  assert.deepEqual(L.blanksLeft(null), []);
  assert.deepEqual(L.blanksLeft(undefined), []);
  assert.deepEqual(L.blanksLeft(5), []);
  assert.deepEqual(L.blanksLeft(""), []);
});

test("blanksLeft: a repeated bracket or underscore run is listed once, and the first-seen order is kept", () => {
  assert.deepEqual(L.blanksLeft("[x] [y] [x] ___ [y] ___"), ["[x]", "[y]", "___"]);
  assert.deepEqual(L.blanksLeft("___ [b] [a] [b]"), ["___", "[b]", "[a]"]);
  assert.deepEqual(L.blanksLeft("[their name] and [their name]"), ["[their name]"]);
});

test("blanksLeft: empty brackets are ignored; a single space inside brackets counts (pinned)", () => {
  assert.deepEqual(L.blanksLeft("[]"), []);
  assert.deepEqual(L.blanksLeft("[[]]"), []);
  assert.deepEqual(L.blanksLeft("a [] b"), []);
  assert.deepEqual(L.blanksLeft("[ ]"), ["[ ]"]);
  assert.deepEqual(L.blanksLeft("[ your name ]"), ["[ your name ]"]);
});

test("blanksLeft: nested brackets pin the inner pair only (pinned)", () => {
  assert.deepEqual(L.blanksLeft("[a [b] c]"), ["[b]"]);
  assert.deepEqual(L.blanksLeft("[[x]]"), ["[x]"]);
  assert.deepEqual(L.blanksLeft("[a]]"), ["[a]"]);
});

test("blanksLeft: brackets split by a newline are ignored, but a closed pair on the next line counts", () => {
  assert.deepEqual(L.blanksLeft("[their\nname]"), []);
  assert.deepEqual(L.blanksLeft("[their name\n] and [ok]"), ["[ok]"]);
  assert.deepEqual(L.blanksLeft("Hi [their\r\nname]"), []);
});

test("blanksLeft: two underscores are not a blank; three or more are, and a long run counts as one", () => {
  assert.deepEqual(L.blanksLeft("__"), []);
  assert.deepEqual(L.blanksLeft("a__b"), []);
  assert.deepEqual(L.blanksLeft("___"), ["___"]);
  assert.deepEqual(L.blanksLeft("_____"), ["_____"]);
  assert.deepEqual(L.blanksLeft("____ and _____"), ["____", "_____"]);
  assert.deepEqual(L.blanksLeft("a___b"), ["___"]);
});

test("blanksLeft: adding plain text that has no brackets or underscores never changes the result", () => {
  const r = prng(20261010);
  const blankAlphabet = ["[", "]", "_", " ", "a", "B", "\n", "."];
  const plainAlphabet = ["a", "z", "Q", " ", "0", "9", "\n", ".", ",", "!", "é", "😀"];
  for (let t = 0; t < 200; t++) {
    let prefix = "";
    const plen = Math.floor(r() * 25);
    for (let i = 0; i < plen; i++) prefix += pick(r, blankAlphabet);
    let suffix = "";
    const slen = Math.floor(r() * 25);
    for (let i = 0; i < slen; i++) suffix += pick(r, plainAlphabet);
    assert.deepEqual(L.blanksLeft(prefix + suffix), L.blanksLeft(prefix), "prefix " + JSON.stringify(prefix) + " suffix " + JSON.stringify(suffix));
  }
});

/* ---------- splitMessage ---------- */

test("splitMessage: CRLF input is pinned to the current result (whole text as body)", () => {
  assert.deepEqual(L.splitMessage("Subject: Hi\r\n\r\nBody"), { subject: "", body: "Subject: Hi\r\n\r\nBody" });
});

test("splitMessage: LF header with a CRLF body keeps the \\r in the body (pinned)", () => {
  assert.deepEqual(L.splitMessage("Subject: Hi\n\nLine1\r\nLine2"), { subject: "Hi", body: "Line1\r\nLine2" });
});

test("splitMessage: a missing blank line after Subject gives no subject and the whole text as body", () => {
  assert.deepEqual(L.splitMessage("Subject: Hi\nBody"), { subject: "", body: "Subject: Hi\nBody" });
  assert.deepEqual(L.splitMessage("Subject: Hi\n  \nBody"), { subject: "", body: "Subject: Hi\n  \nBody" });
});

test("splitMessage: a Subject with an empty value gives an empty subject, with or without spaces after the colon", () => {
  assert.deepEqual(L.splitMessage("Subject:\n\nBody"), { subject: "", body: "Body" });
  assert.deepEqual(L.splitMessage("Subject:   \n\nBody"), { subject: "", body: "Body" });
  assert.deepEqual(L.splitMessage("Subject: \n\n"), { subject: "", body: "" });
});

test("splitMessage: a body that contains Subject: again keeps that line in the body", () => {
  assert.deepEqual(L.splitMessage("Subject: A\n\nSubject: B\n\nC"), { subject: "A", body: "Subject: B\n\nC" });
  assert.deepEqual(L.splitMessage("Subject: A\n\nSubject: A\n\nSubject: A"), { subject: "A", body: "Subject: A\n\nSubject: A" });
});

/* ---------- mailtoHref and smsHref: round trip and no raw breaks ---------- */

const AWKWARD = [
  "Hi & bye",
  "Q#1 is 100% sure",
  "1+1=2 and a+b",
  "line one\nline two\n\nline four",
  "tabs\tand  two spaces",
  "a?b=c&d=e",
  "😀 Thanks 👋🏽 family 👨‍👩‍👧",
  "quote \" and apostrophe ' and slash \\",
  "",
  "\r\n",
  "x".repeat(4000) + " 🎉 " + "y".repeat(2000),
];

test("mailtoHref: subject and body decode back exactly for emoji, &, #, %, +, and newlines", () => {
  for (const s of AWKWARD) {
    for (const b of AWKWARD) {
      const href = L.mailtoHref(s, b);
      const q = decodeQuery(href, "mailto:?");
      assert.deepEqual(q, [["subject", s], ["body", b]], "subject " + JSON.stringify(s).slice(0, 40) + " body " + JSON.stringify(b).slice(0, 40));
    }
  }
});

test("mailtoHref: the href has no raw space, newline, carriage return or # (the rest is encoded)", () => {
  for (const s of AWKWARD) {
    const href = L.mailtoHref(s, s);
    assert.equal(/[ \n\r#]/.test(href), false, "raw break in " + JSON.stringify(href).slice(0, 80));
  }
});

test("smsHref: body decodes back exactly for emoji, &, #, %, +, and newlines", () => {
  for (const b of AWKWARD) {
    const href = L.smsHref(b);
    const q = decodeQuery(href, "sms:?");
    assert.deepEqual(q, [["body", b]], "body " + JSON.stringify(b).slice(0, 40));
  }
});

test("smsHref: the href has no raw space, newline, carriage return or # (the rest is encoded)", () => {
  for (const b of AWKWARD) {
    const href = L.smsHref(b);
    assert.equal(/[ \n\r#]/.test(href), false, "raw break in " + JSON.stringify(href).slice(0, 80));
  }
});

test("mailtoHref and smsHref: a percent sign typed by a teen is encoded once, not twice", () => {
  assert.equal(L.mailtoHref("100%", "%25"), "mailto:?subject=100%25&body=%2525");
  assert.equal(L.smsHref("50% off"), "sms:?&body=50%25%20off");
});

test("mailtoHref and smsHref: a body with a template blank keeps the brackets and underscores as typed", () => {
  const body = "Hi [their name], it is ___.";
  assert.deepEqual(decodeQuery(L.mailtoHref("Hi", body), "mailto:?"), [["subject", "Hi"], ["body", body]]);
  assert.deepEqual(decodeQuery(L.smsHref(body), "sms:?"), [["body", body]]);
});
