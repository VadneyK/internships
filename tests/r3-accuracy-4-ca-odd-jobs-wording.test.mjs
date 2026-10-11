// r3-accuracy-4: California 12 and 13 year olds. The state chart says "no permit for irregular odd jobs
// in private homes" and "no permit if you are self-employed on a regular route and at least 12".
// The copy must not say "you can do things like", and the odd-jobs sentence must keep the
// irregular/occasional qualifier.
// Run with: node --test tests/r3-accuracy-4-ca-odd-jobs-wording.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const permits = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const ca = permits.states.ca;

test("permits.json: the 'you can do things like' claim is gone", () => {
  const raw = fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8");
  assert.equal(raw.includes("you can do things like"), false);
  assert.equal(ca.minAge.note.includes("you can do things like"), false);
});

test("permits.json: the CA 12 and 13 odd-jobs sentence keeps the irregular qualifier and the hour caveat", () => {
  const note = ca.minAge.note;
  assert.ok(/irregular odd jobs in private homes, such as babysitting and yard work/.test(note), note);
  assert.ok(/none for a self-employed newspaper route at age 12 or older/.test(note), note);
  assert.ok(note.includes("The chart does not say these jobs skip the hour limits"), note);
  assert.ok(note.includes("833-526-4636"));
});

test("permits.json: the pet care sentence is kept", () => {
  assert.ok(ca.minAge.note.includes("no page we read names pet care, so ask the Labor Commissioner at 833-526-4636 first."));
});

test("permits.json: kinds.odd keeps the occasional qualifier", () => {
  assert.ok(/occasional odd jobs in private homes/.test(ca.kinds.odd.text), ca.kinds.odd.text);
});

for (const rel of ["src/rules.html", "rules.html"]) {
  const html = fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

  test(`${rel}: 'you can do things like' is gone`, () => {
    assert.equal(html.includes("you can do things like"), false);
  });

  test(`${rel}: the 12 and 13 odd-jobs sentence has the irregular qualifier and the hour caveat`, () => {
    assert.ok(
      html.includes("At 12 and 13 the state chart says no permit for irregular odd jobs in private homes, such as babysitting and yard work, and none for a self-employed newspaper route at age 12 or older. The chart does not say these jobs skip the hour limits, so ask the Labor Commissioner at 833-526-4636 before you plan how much you can do."),
      `${rel} sentence missing`
    );
  });

  test(`${rel}: the quick answer has an irregular or occasional qualifier`, () => {
    const m = html.match(/<h3>Do I need a work permit\?<\/h3><p>([\s\S]*?)<\/p>/);
    assert.ok(m, "quick answer card found");
    assert.ok(/irregular|occasional/.test(m[1]), "quick answer qualifier");
    assert.ok(m[1].includes("A babysitting or yard-work job for neighbors does not need one."));
  });

  test(`${rel}: the 12 and 13 card keeps the pet care sentence`, () => {
    assert.ok(html.includes("no page we read names pet care, so ask the Labor Commissioner at 833-526-4636 first."));
  });
}
