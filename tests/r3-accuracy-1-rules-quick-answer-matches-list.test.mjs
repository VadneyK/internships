// r3-accuracy-1: the Rules page "Do I need a work permit?" quick answer must agree with the
// "You do not need a permit for" list further down the same page.
// Run with: node --test tests/r3-accuracy-1-rules-quick-answer-matches-list.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function quickAnswer(html) {
  const m = html.match(/<h3>Do I need a work permit\?<\/h3><p>([\s\S]*?)<\/p>/);
  assert.ok(m, "quick answer card found");
  return m[1];
}

for (const rel of ["src/rules.html", "rules.html"]) {
  const html = fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
  const qa = quickAnswer(html);

  test(`${rel}: quick answer keeps the babysitting and yard-work sentence`, () => {
    assert.ok(qa.includes("A babysitting or yard-work job for neighbors does not need one."));
  });

  test(`${rel}: quick answer names newspaper routes and volunteering as no-permit work`, () => {
    assert.ok(qa.includes("Delivering newspapers on your own route (age 12 or older)"));
    assert.ok(qa.includes("true unpaid volunteering, with parent permission on file with your school"));
    assert.ok(html.includes("Delivering newspapers on your own route (age 12 or older)"), "list still names newspaper route");
    assert.ok(html.includes("True unpaid volunteering, with parent permission on file with your school"), "list still names volunteering");
  });

  test(`${rel}: quick answer does not send newspaper routes or unpaid volunteering to the Labor Commissioner`, () => {
    const sendsAsk = /ask the Labor Commissioner[^.]*\./g;
    for (const sentence of qa.match(sendsAsk) || []) {
      assert.equal(/newspaper|unpaid volunteer/i.test(sentence), false, `contradicting sentence: ${sentence}`);
    }
  });

  test(`${rel}: quick answer sends other self-run work to the Labor Commissioner`, () => {
    assert.match(qa, /other work you run yourself, such as tutoring, selling crafts or pet care, the page does not name it, so ask the Labor Commissioner at 833-526-4636\./);
  });
}
