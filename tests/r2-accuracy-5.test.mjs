import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const d = JSON.parse(fs.readFileSync(new URL("../data/interview.json", import.meta.url), "utf8"));

test("day tip 4 has no dangling suggestion label", () => {
  assert.ok(!/Our suggestion/.test(d.day[3]));
  assert.match(d.day[3], /eye contact/);
});

test("every application tip says its source or that it is a suggestion", () => {
  assert.equal(d.appSource.length, d.app.length);
  d.appSource.forEach((s) => {
    const hasSrc = Array.isArray(s.src) && s.src.length > 0 && s.src.every((x) => /^https:\/\//.test(x.u) && x.t);
    assert.ok(hasSrc || /Our suggestion|our suggestion/.test(s.note || ""));
  });
});
