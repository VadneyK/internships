// Ohio 16 and 17 year olds are not told they need a permit for summer work (ticket r3-accuracy-2).
// Run with: node --test tests/r3-accuracy-2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

test("Ohio job: 15 needs a permit, 16 and 17 are asked and the text names summer", () => {
  assert.equal(L.permitFor(PM, "oh", 15, "job").verdict, "need");
  [16, 17].forEach((age) => {
    const r = L.permitFor(PM, "oh", age, "job");
    assert.equal(r.verdict, "ask", "age " + age);
    assert.match(r.text, /summer/, "age " + age);
  });
});

test("Ohio program: 16 is asked, 15 still needs a permit", () => {
  assert.equal(L.permitFor(PM, "oh", 16, "program").verdict, "ask");
  assert.equal(L.permitFor(PM, "oh", 15, "program").verdict, "need");
});

test("a job text or step that says 'need none' or 'no permit' for some ages never gets a need verdict at those ages", () => {
  let checked = 0;
  for (const [st, s] of Object.entries(PM.states)) {
    const sources = [s.kinds.job.text, ...(s.steps || [])];
    for (const src of sources) {
      for (const sentence of src.split(/(?<=\.)\s+/)) {
        if (!/need none|no permit/i.test(sentence)) continue;
        const ages = (sentence.match(/\b1[2-8]\b/g) || []).map(Number);
        for (const age of ages) {
          checked++;
          assert.notEqual(L.permitFor(PM, st, age, "job").verdict, "need", st + " at " + age + ": " + sentence);
        }
      }
    }
  }
  assert.ok(checked >= 2, "the Ohio summer sentence should be checked at 16 and 17");
});
