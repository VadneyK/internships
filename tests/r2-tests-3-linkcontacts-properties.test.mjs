// Ticket r2-tests-3: property test that linkContacts and esc never make unsafe or broken HTML.
// Run with: node --test tests/r2-tests-3-linkcontacts-properties.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const L = createRequire(import.meta.url)("../assets/js/lib.js");

// Fixed-seed generator (mulberry32). No Math.random, so every run is the same.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261010);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const digits = (n) => { let s = ""; for (let i = 0; i < n; i++) s += Math.floor(rand() * 10); return s; };
const word = () => pick(["call", "Office", "hours", "x", "Mon-Fri", "or", "at", "ext", "a", "Dept", "info"]);
const phone = () => {
  const d = digits(10);
  const lead = pick(["", "", "1-", "1 ", "1."]);
  const sep = pick(["-", ".", " "]);
  const area = pick([d.slice(0, 3) + sep, "(" + d.slice(0, 3) + ") ", "(" + d.slice(0, 3) + ")"]);
  return lead + area + d.slice(3, 6) + sep + d.slice(6);
};
const email = () => pick(["a", "jo.e", "x_y+z", "info", "N-1%2"]) + "@" + pick(["ex.org", "dol.gov", "a-b.co.uk", "x.com"]);
const junk = () => pick(["<", ">", "<script>", "</a>", '"', "'", "&", "&amp;", "&#39;", "<a href=x>", '" onmouseover="x', "@", "5551234", digits(3), digits(11), "--", "(", ")", "\n", "  "]);
function gen() {
  const n = 1 + Math.floor(rand() * 8);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const r = rand();
    parts.push(r < 0.25 ? phone() : r < 0.45 ? email() : r < 0.7 ? junk() : word());
  }
  return parts.join(pick(["", " ", ", ", " or "]));
}

const TAG = /<a href="tel:\+1\d{10}">|<a href="mailto:[^"\s<>&']+">|<\/a>/g;

test("linkContacts: 3000 seeded random strings stay safe and lossless", () => {
  const t0 = Date.now();
  let phones = 0, mails = 0;
  for (let i = 0; i < 3000; i++) {
    const input = gen();
    const out = L.linkContacts(input);
    const stripped = out.replace(TAG, "");
    const ctx = JSON.stringify(input) + " => " + JSON.stringify(out);
    assert.ok(!/[<>]/.test(stripped), "raw angle bracket outside our anchors: " + ctx);
    assert.equal(stripped, L.esc(input), "stripping tags must give esc(input): " + ctx);
    // Tags must be balanced and only ours.
    const opens = (out.match(/<a /g) || []).length, closes = (out.match(/<\/a>/g) || []).length;
    assert.equal(opens, closes, "unbalanced anchors: " + ctx);
    for (const m of out.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)) {
      const href = m[1], text = m[2];
      assert.ok(!/["'\s<>]/.test(href), "bad char in href: " + ctx);
      if (href.startsWith("tel:")) {
        phones++;
        assert.match(href, /^tel:\+1\d{10}$/, ctx);
        let d = text.replace(/\D/g, "");
        if (d.length === 10) d = "1" + d;
        assert.equal(href.slice(5), d, "tel digits differ from visible text: " + ctx);
      } else {
        mails++;
        assert.ok(href.startsWith("mailto:"), ctx);
        assert.equal(href.slice(7), text, ctx);
      }
    }
  }
  assert.ok(phones > 300 && mails > 300, "generator should hit both kinds, got " + phones + "/" + mails);
  assert.ok(Date.now() - t0 < 2000, "should run in under 2 seconds");
});

test("esc: output never contains raw < > \" ' and ampersands are always entities", () => {
  for (let i = 0; i < 2000; i++) {
    const out = L.esc(gen());
    assert.ok(!/[<>"']/.test(out), out);
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(out), out);
  }
});
