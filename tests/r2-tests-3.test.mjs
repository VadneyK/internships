// Run with: node --test tests/r2-tests-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const permits = JSON.parse(readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

test("fmtDate formats a real date and never throws on bad input", () => {
  assert.equal(L.fmtDate(new Date(2026, 9, 9)), "Oct 9, 2026");
  assert.equal(L.fmtDate(null), "");
  assert.equal(L.fmtDate(undefined), "");
  assert.equal(L.fmtDate(new Date("x")), "");
  assert.equal(L.fmtDate("2026-10-09"), "");
});

test("regionLabel", () => {
  assert.equal(L.regionLabel("davis"), "Davis");
  assert.equal(L.regionLabel("nope"), "");
});

test("safeUrl rejects unusable links", () => {
  ["https://", "https:// a", "https://a.b\nx", " https://a.b", "javascript:alert(1)", "//evil.com", "data:text/html,x", "", null, undefined, 42]
    .forEach((u) => assert.equal(L.safeUrl(u), "", String(u)));
});
test("safeUrl keeps good links", () => {
  assert.equal(L.safeUrl("https://example.org/a?b=1#c"), "https://example.org/a?b=1#c");
  assert.equal(L.safeUrl("HTTPS://EXAMPLE.ORG"), "HTTPS://EXAMPLE.ORG");
  assert.equal(L.safeUrl("http://example.org"), "http://example.org");
});

test("permitFor ignores inherited property names", () => {
  ["__proto__", "constructor", "toString"].forEach((st) => {
    assert.equal(L.permitFor(permits, st, 15, "job").verdict, "nostate", st);
  });
  ["__proto__", "constructor", "hasOwnProperty"].forEach((k) => {
    assert.equal(L.permitFor(permits, "ca", 15, k), null, k);
  });
  assert.ok(L.permitFor(permits, "ca", 15, "job").verdict);
});

test("icsEvent returns empty text for a bad date and is unchanged for a good one", () => {
  const stamp = new Date(Date.UTC(2026, 9, 9, 12, 0, 0));
  ["garbage", "", undefined].forEach((d) => {
    const out = L.icsEvent({ dateISO: d, uid: "u", title: "t", desc: "d", stamp });
    assert.equal(out, "");
    assert.ok(!out.includes("NaN"));
  });
  const ok = L.icsEvent({ dateISO: "2026-12-31", uid: "u", title: "T", desc: "D", stamp });
  assert.ok(ok.includes("DTSTART;VALUE=DATE:20261231"));
  assert.ok(ok.includes("DTEND;VALUE=DATE:20270101"));
  assert.ok(!ok.includes("NaN"));
});
